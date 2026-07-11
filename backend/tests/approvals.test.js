/**
 * Approval workflow API (Module 11 · Task 2):
 *   GET/POST /approvals, GET /approvals/:id, POST /approvals/:id/decision,
 *   POST /approvals/:id/cancel.
 * Covers the permission gates, tenant isolation, the single-pending-request rule,
 * approver validation, the decide (approve/reject, `all` vs `any` policy) and
 * cancel flows over HTTP.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Document from '../src/features/documents/document.model.js';
import ApprovalRequest from '../src/features/approvals/approval.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, APPROVAL_STATUS, APPROVAL_POLICY } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser({ role = ROLES.MANAGER, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'Ap',
    lastName: 'Prover',
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

function makeDocument(org, overrides = {}) {
  return Document.create({ organization: org, title: 'Contract', content: 'body', ...overrides });
}

describe('POST /approvals', () => {
  it('routes a document for approval with pending approver steps', async () => {
    const { token, org, user } = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: org });
    const document = await makeDocument(org);

    const res = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(token))
      .send({ documentId: document.id, approverIds: [approver.user.id], note: 'Please review' });

    expect(res.status).toBe(201);
    const approval = res.body.data.approval;
    expect(approval.status).toBe(APPROVAL_STATUS.PENDING);
    expect(approval.policy).toBe(APPROVAL_POLICY.ALL);
    expect(approval.document).toBe(document.id);
    expect(approval.requestedBy).toBe(user.id);
    expect(approval.note).toBe('Please review');
    expect(approval.approvers).toHaveLength(1);
    expect(approval.approvers[0].user).toBe(approver.user.id);
    expect(approval.approvers[0].status).toBe('pending');
  });

  it('de-duplicates approver ids', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: org });
    const document = await makeDocument(org);

    const res = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(token))
      .send({ documentId: document.id, approverIds: [approver.user.id, approver.user.id] });

    expect(res.status).toBe(201);
    expect(res.body.data.approval.approvers).toHaveLength(1);
  });

  it('409s when the document already has a pending request', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: org });
    const document = await makeDocument(org);
    const body = { documentId: document.id, approverIds: [approver.user.id] };

    await request(app).post(`${PREFIX}/approvals`).set(bearer(token)).send(body);
    const dup = await request(app).post(`${PREFIX}/approvals`).set(bearer(token)).send(body);

    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('APPROVAL_ALREADY_PENDING');
  });

  it('404s for a document in another org (isolation)', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: org });
    const foreign = await makeDocument(new mongoose.Types.ObjectId());

    const res = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(token))
      .send({ documentId: foreign.id, approverIds: [approver.user.id] });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('404s for an approver in another org', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const document = await makeDocument(org);
    const foreignApprover = await makeUser();

    const res = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(token))
      .send({ documentId: document.id, approverIds: [foreignApprover.user.id] });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('APPROVER_NOT_FOUND');
  });

  it('forbids a member without approval:request (403)', async () => {
    const { token, org } = await makeUser({ role: ROLES.MEMBER });
    const approver = await makeUser({ organization: org });
    const document = await makeDocument(org);

    const res = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(token))
      .send({ documentId: document.id, approverIds: [approver.user.id] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('GET /approvals', () => {
  it('lists only the actor org requests (isolation) and filters by status', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: org });
    await ApprovalRequest.create([
      { organization: org, document: new mongoose.Types.ObjectId(), approvers: [{ user: approver.user.id }] },
      { organization: org, document: new mongoose.Types.ObjectId(), approvers: [{ user: approver.user.id }], status: APPROVAL_STATUS.APPROVED },
      { organization: new mongoose.Types.ObjectId(), document: new mongoose.Types.ObjectId(), approvers: [{ user: new mongoose.Types.ObjectId() }] },
    ]);

    const all = await request(app).get(`${PREFIX}/approvals`).set(bearer(token));
    expect(all.status).toBe(200);
    expect(all.body.data.approvals).toHaveLength(2);
    expect(all.body.meta.total).toBe(2);

    const pending = await request(app)
      .get(`${PREFIX}/approvals?status=${APPROVAL_STATUS.PENDING}`)
      .set(bearer(token));
    expect(pending.body.data.approvals).toHaveLength(1);
  });

  it('filters by approver (my approvals)', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const me = await makeUser({ organization: org });
    const other = await makeUser({ organization: org });
    await ApprovalRequest.create([
      { organization: org, document: new mongoose.Types.ObjectId(), approvers: [{ user: me.user.id }] },
      { organization: org, document: new mongoose.Types.ObjectId(), approvers: [{ user: other.user.id }] },
    ]);

    const res = await request(app)
      .get(`${PREFIX}/approvals?approverId=${me.user.id}`)
      .set(bearer(token));
    expect(res.body.data.approvals).toHaveLength(1);
    expect(res.body.data.approvals[0].approvers[0].user).toBe(me.user.id);
  });

  it('allows a member to read (approval:read)', async () => {
    const { token } = await makeUser({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/approvals`).set(bearer(token));
    expect(res.status).toBe(200);
  });
});

describe('GET /approvals/:id', () => {
  it('404s for a request in another org (isolation)', async () => {
    const { token } = await makeUser({ role: ROLES.ADMIN });
    const other = await ApprovalRequest.create({
      organization: new mongoose.Types.ObjectId(),
      document: new mongoose.Types.ObjectId(),
      approvers: [{ user: new mongoose.Types.ObjectId() }],
    });
    const res = await request(app).get(`${PREFIX}/approvals/${other.id}`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('APPROVAL_NOT_FOUND');
  });
});

describe('POST /approvals/:id/decision', () => {
  async function setup({ policy = APPROVAL_POLICY.ALL, extraApprover = false } = {}) {
    const admin = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: admin.org });
    const approvers = [{ user: approver.user.id }];
    let second;
    if (extraApprover) {
      second = await makeUser({ organization: admin.org });
      approvers.push({ user: second.user.id });
    }
    const approval = await ApprovalRequest.create({
      organization: admin.org,
      document: new mongoose.Types.ObjectId(),
      policy,
      approvers,
    });
    return { admin, approver, second, approval };
  }

  it('approves the request when the sole approver approves (all policy)', async () => {
    const { approver, approval } = await setup();
    const res = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve', comment: 'LGTM' });

    expect(res.status).toBe(200);
    expect(res.body.data.approval.status).toBe(APPROVAL_STATUS.APPROVED);
    expect(res.body.data.approval.approvers[0].status).toBe('approved');
    expect(res.body.data.approval.approvers[0].comment).toBe('LGTM');
    expect(res.body.data.approval.decidedAt).not.toBeNull();
  });

  it('stays pending until all approvers approve (all policy)', async () => {
    const { approver, second, approval } = await setup({ extraApprover: true });

    const first = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve' });
    expect(first.body.data.approval.status).toBe(APPROVAL_STATUS.PENDING);

    const done = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(second.token))
      .send({ decision: 'approve' });
    expect(done.body.data.approval.status).toBe(APPROVAL_STATUS.APPROVED);
  });

  it('approves on the first approval under the any policy', async () => {
    const { approver, approval } = await setup({ policy: APPROVAL_POLICY.ANY, extraApprover: true });
    const res = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve' });
    expect(res.body.data.approval.status).toBe(APPROVAL_STATUS.APPROVED);
  });

  it('rejects the whole request when any approver rejects', async () => {
    const { approver, approval } = await setup({ extraApprover: true });
    const res = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'reject', comment: 'No' });
    expect(res.body.data.approval.status).toBe(APPROVAL_STATUS.REJECTED);
  });

  it('403s when the actor is not an approver', async () => {
    const { admin, approval } = await setup();
    const outsider = await makeUser({ role: ROLES.MANAGER, organization: admin.org });
    const res = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(outsider.token))
      .send({ decision: 'approve' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_AN_APPROVER');
  });

  it('400s on a second decision by the same approver', async () => {
    const { approver, approval } = await setup({ extraApprover: true });
    await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve' });
    const again = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('ALREADY_DECIDED');
  });

  it('400s deciding on a non-pending request', async () => {
    const { approver, approval } = await setup();
    await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve' });
    const res = await request(app)
      .post(`${PREFIX}/approvals/${approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('APPROVAL_NOT_PENDING');
  });
});

describe('POST /approvals/:id/cancel', () => {
  it('cancels a pending request', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const approval = await ApprovalRequest.create({
      organization: org,
      document: new mongoose.Types.ObjectId(),
      approvers: [{ user: new mongoose.Types.ObjectId() }],
    });
    const res = await request(app).post(`${PREFIX}/approvals/${approval.id}/cancel`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.approval.status).toBe(APPROVAL_STATUS.CANCELLED);
    expect(res.body.data.approval.decidedAt).not.toBeNull();
  });

  it('400s cancelling a non-pending request', async () => {
    const { token, org } = await makeUser({ role: ROLES.ADMIN });
    const approval = await ApprovalRequest.create({
      organization: org,
      document: new mongoose.Types.ObjectId(),
      approvers: [{ user: new mongoose.Types.ObjectId() }],
      status: APPROVAL_STATUS.APPROVED,
    });
    const res = await request(app).post(`${PREFIX}/approvals/${approval.id}/cancel`).set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('APPROVAL_NOT_PENDING');
  });

  it('forbids a member without approval:cancel (403)', async () => {
    const { token, org } = await makeUser({ role: ROLES.MEMBER });
    const approval = await ApprovalRequest.create({
      organization: org,
      document: new mongoose.Types.ObjectId(),
      approvers: [{ user: new mongoose.Types.ObjectId() }],
    });
    const res = await request(app).post(`${PREFIX}/approvals/${approval.id}/cancel`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});
