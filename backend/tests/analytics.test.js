/**
 * Analytics API (Module 15): GET /analytics/summary, GET /analytics/recent.
 * Covers the org-scoped rollup counts + status breakdowns, pending-approval
 * count, the recent-documents feed (order + limit), tenant isolation, the
 * `analytics:read` gate (every role has it), and authentication.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Document from '../src/features/documents/document.model.js';
import Customer from '../src/features/customers/customer.model.js';
import Product from '../src/features/products/product.model.js';
import Template from '../src/features/templates/template.model.js';
import ApprovalRequest from '../src/features/approvals/approval.model.js';
import { signAccessToken } from '../src/utils/token.js';
import {
  ROLES,
  DOCUMENT_STATUS,
  CUSTOMER_STATUS,
  APPROVAL_STATUS,
} from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser({ role = ROLES.MEMBER, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'Dash',
    lastName: 'Board',
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

const makeDoc = (org, overrides = {}) =>
  Document.create({ organization: org, title: 'Doc', content: 'body', ...overrides });

describe('GET /analytics/summary', () => {
  it('returns org-scoped totals with status breakdowns + pending approvals', async () => {
    const { token, org } = await makeUser();

    await makeDoc(org, { status: DOCUMENT_STATUS.DRAFT });
    await makeDoc(org, { status: DOCUMENT_STATUS.DRAFT });
    const finalDoc = await makeDoc(org, { status: DOCUMENT_STATUS.FINAL });
    await Customer.create({ organization: org, name: 'Acme', status: CUSTOMER_STATUS.ACTIVE });
    await Customer.create({ organization: org, name: 'Globex', status: CUSTOMER_STATUS.INACTIVE });
    await Product.create({ organization: org, name: 'Widget' });
    await Template.create({ organization: org, name: 'Invoice', content: 'Hi {{name}}' });
    await ApprovalRequest.create({
      organization: org,
      document: finalDoc.id,
      status: APPROVAL_STATUS.PENDING,
      approvers: [{ user: new mongoose.Types.ObjectId() }],
    });

    // Another org — must NOT be counted.
    const other = new mongoose.Types.ObjectId();
    await makeDoc(other, { status: DOCUMENT_STATUS.DRAFT });
    await Product.create({ organization: other, name: 'Foreign' });

    const res = await request(app).get(`${PREFIX}/analytics/summary`).set(bearer(token));

    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary.documents.total).toBe(3);
    expect(summary.documents.byStatus[DOCUMENT_STATUS.DRAFT]).toBe(2);
    expect(summary.documents.byStatus[DOCUMENT_STATUS.FINAL]).toBe(1);
    expect(summary.documents.byStatus[DOCUMENT_STATUS.ARCHIVED]).toBe(0);
    expect(summary.customers.total).toBe(2);
    expect(summary.customers.byStatus[CUSTOMER_STATUS.ACTIVE]).toBe(1);
    expect(summary.products.total).toBe(1);
    expect(summary.templates.total).toBe(1);
    expect(summary.approvals.pending).toBe(1);
  });

  it('returns zeroed totals for an org with no data', async () => {
    const { token } = await makeUser();
    const res = await request(app).get(`${PREFIX}/analytics/summary`).set(bearer(token));

    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary.documents.total).toBe(0);
    expect(summary.documents.byStatus[DOCUMENT_STATUS.DRAFT]).toBe(0);
    expect(summary.products.total).toBe(0);
    expect(summary.approvals.pending).toBe(0);
  });

  it('is readable by every role (member)', async () => {
    const { token } = await makeUser({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/analytics/summary`).set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get(`${PREFIX}/analytics/summary`);
    expect(res.status).toBe(401);
  });
});

describe('GET /analytics/recent', () => {
  it('returns the org\'s documents newest-first, honouring limit', async () => {
    const { token, org } = await makeUser();
    await makeDoc(org, { title: 'Oldest' });
    await makeDoc(org, { title: 'Middle' });
    await makeDoc(org, { title: 'Newest' });
    // Another org — must NOT appear.
    await makeDoc(new mongoose.Types.ObjectId(), { title: 'Foreign' });

    const res = await request(app)
      .get(`${PREFIX}/analytics/recent`)
      .query({ limit: 2 })
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(2);
    expect(res.body.data.documents[0].title).toBe('Newest');
    expect(res.body.data.documents[1].title).toBe('Middle');
    // Lightweight rows — the rendered content payload is not included.
    expect(res.body.data.documents[0].content).toBeUndefined();
  });

  it('defaults the limit when none is supplied', async () => {
    const { token, org } = await makeUser();
    for (let i = 0; i < 7; i += 1) await makeDoc(org, { title: `Doc ${i}` });

    const res = await request(app).get(`${PREFIX}/analytics/recent`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(5); // ANALYTICS_RECENT_DEFAULT_LIMIT
  });

  it('rejects an out-of-range limit (422 validation error)', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get(`${PREFIX}/analytics/recent`)
      .query({ limit: 999 })
      .set(bearer(token));
    expect(res.status).toBe(422);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get(`${PREFIX}/analytics/recent`);
    expect(res.status).toBe(401);
  });
});
