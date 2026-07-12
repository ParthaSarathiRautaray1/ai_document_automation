/**
 * Audit log API (Module 14): GET /audit-logs, GET /audit-logs/:id.
 * Covers the admin-level `audit:read` gate, tenant isolation, filtering
 * (entityType / action / actor) + search, single-entry read + cross-org 404,
 * and the document/approval → audit-trail wiring.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Document from '../src/features/documents/document.model.js';
import AuditLog from '../src/features/audit/audit.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser({ role = ROLES.ADMIN, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'Aud',
    lastName: 'Itor',
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

function makeLog(org, overrides = {}) {
  return AuditLog.create({
    organization: org,
    action: AUDIT_ACTION.DOCUMENT_GENERATE,
    entityType: AUDIT_ENTITY_TYPE.DOCUMENT,
    entityLabel: 'Some document',
    ...overrides,
  });
}

describe('GET /audit-logs', () => {
  it('lists the org\'s entries newest first (admin)', async () => {
    const { token, org } = await makeUser();
    await makeLog(org, { entityLabel: 'First' });
    await makeLog(org, { entityLabel: 'Second' });
    // Another org — must NOT appear.
    await makeLog(new mongoose.Types.ObjectId(), { entityLabel: 'Other org' });

    const res = await request(app).get(`${PREFIX}/audit-logs`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.auditLogs).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.auditLogs[0].entityLabel).toBe('Second');
  });

  it('filters by entityType and action', async () => {
    const { token, org } = await makeUser();
    await makeLog(org, { action: AUDIT_ACTION.DOCUMENT_DELETE, entityType: AUDIT_ENTITY_TYPE.DOCUMENT });
    await makeLog(org, { action: AUDIT_ACTION.APPROVAL_REQUEST, entityType: AUDIT_ENTITY_TYPE.APPROVAL });

    const byType = await request(app)
      .get(`${PREFIX}/audit-logs`)
      .query({ entityType: AUDIT_ENTITY_TYPE.APPROVAL })
      .set(bearer(token));
    expect(byType.body.data.auditLogs).toHaveLength(1);
    expect(byType.body.data.auditLogs[0].entityType).toBe(AUDIT_ENTITY_TYPE.APPROVAL);

    const byAction = await request(app)
      .get(`${PREFIX}/audit-logs`)
      .query({ action: AUDIT_ACTION.DOCUMENT_DELETE })
      .set(bearer(token));
    expect(byAction.body.data.auditLogs).toHaveLength(1);
    expect(byAction.body.data.auditLogs[0].action).toBe(AUDIT_ACTION.DOCUMENT_DELETE);
  });

  it('filters by actor', async () => {
    const { token, org } = await makeUser();
    const actorA = new mongoose.Types.ObjectId();
    await makeLog(org, { actor: actorA });
    await makeLog(org, { actor: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .get(`${PREFIX}/audit-logs`)
      .query({ actorId: String(actorA) })
      .set(bearer(token));

    expect(res.body.data.auditLogs).toHaveLength(1);
    expect(res.body.data.auditLogs[0].actor).toBe(String(actorA));
  });

  it('searches over action/label', async () => {
    const { token, org } = await makeUser();
    await makeLog(org, { entityLabel: 'Quarterly report' });
    await makeLog(org, { entityLabel: 'Invoice 42' });

    const res = await request(app)
      .get(`${PREFIX}/audit-logs`)
      .query({ q: 'invoice' })
      .set(bearer(token));

    expect(res.body.data.auditLogs).toHaveLength(1);
    expect(res.body.data.auditLogs[0].entityLabel).toBe('Invoice 42');
  });

  it('forbids a member (no audit:read) with 403', async () => {
    const { token } = await makeUser({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/audit-logs`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get(`${PREFIX}/audit-logs`);
    expect(res.status).toBe(401);
  });
});

describe('GET /audit-logs/:id', () => {
  it('returns a single entry in the org', async () => {
    const { token, org } = await makeUser();
    const log = await makeLog(org, { entityLabel: 'Detail me' });

    const res = await request(app).get(`${PREFIX}/audit-logs/${log.id}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.auditLog.entityLabel).toBe('Detail me');
  });

  it('404s for an entry in another org (tenant isolation)', async () => {
    const { token } = await makeUser();
    const foreign = await makeLog(new mongoose.Types.ObjectId());

    const res = await request(app).get(`${PREFIX}/audit-logs/${foreign.id}`).set(bearer(token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('AUDIT_LOG_NOT_FOUND');
  });
});

describe('action → audit-trail wiring', () => {
  it('records an approval.request entry when a document is routed for approval', async () => {
    const requester = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: requester.org, role: ROLES.MEMBER });
    const document = await Document.create({
      organization: requester.org,
      title: 'Contract',
      content: 'body',
    });

    const res = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(requester.token))
      .send({ documentId: document.id, approverIds: [approver.user.id] });
    expect(res.status).toBe(201);

    const entries = await AuditLog.find({
      organization: requester.org,
      action: AUDIT_ACTION.APPROVAL_REQUEST,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].entityType).toBe(AUDIT_ENTITY_TYPE.APPROVAL);
    expect(String(entries[0].actor)).toBe(requester.user.id);
    expect(entries[0].entityLabel).toBe('Contract');
    expect(entries[0].metadata.documentId).toBe(String(document.id));
  });
});
