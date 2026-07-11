/**
 * Email log endpoints (Module 9): GET /emails, GET /emails/:id,
 * POST /emails/:id/retry. Covers the permission gate (email:read / email:retry),
 * tenant isolation, list filtering/search, and the retry path (which, with no
 * provider configured, re-attempts and ends `skipped`).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import EmailMessage from '../src/features/emails/email.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, EMAIL_STATUS, EMAIL_TYPE } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeActor({ role = ROLES.MANAGER, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'Act',
    lastName: 'Or',
    email: `actor-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

function makeMessage(org, overrides = {}) {
  return EmailMessage.create({
    organization: org,
    to: 'ada@example.com',
    subject: 'Your invoice',
    html: '<p>Hi</p>',
    type: EMAIL_TYPE.DOCUMENT_DELIVERY,
    ...overrides,
  });
}

describe('GET /emails', () => {
  it('lists the org email log with pagination meta', async () => {
    const { token, org } = await makeActor();
    await makeMessage(org, { subject: 'Invoice A', to: 'a@x.com' });
    await makeMessage(org, { subject: 'Quote B', to: 'b@x.com' });
    await makeMessage(new mongoose.Types.ObjectId(), { subject: 'Other org' }); // isolation

    const res = await request(app).get(`${PREFIX}/emails`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.emails).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('searches subject + recipient and filters by status', async () => {
    const { token, org } = await makeActor();
    await makeMessage(org, { subject: 'March Invoice', to: 'billing@acme.test', status: EMAIL_STATUS.SENT });
    await makeMessage(org, { subject: 'Welcome', to: 'ada@x.com', status: EMAIL_STATUS.FAILED });

    const bySearch = await request(app).get(`${PREFIX}/emails?q=acme`).set(bearer(token));
    expect(bySearch.body.data.emails).toHaveLength(1);
    expect(bySearch.body.data.emails[0].subject).toBe('March Invoice');

    const byStatus = await request(app).get(`${PREFIX}/emails?status=failed`).set(bearer(token));
    expect(byStatus.body.data.emails).toHaveLength(1);
    expect(byStatus.body.data.emails[0].subject).toBe('Welcome');
  });

  it('forbids a member (no email:read) with 403', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/emails`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('GET /emails/:id', () => {
  it('returns a message in the actor org', async () => {
    const { token, org } = await makeActor();
    const message = await makeMessage(org);
    const res = await request(app).get(`${PREFIX}/emails/${message.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.email.id).toBe(message.id);
  });

  it('404s a message in another org (isolation)', async () => {
    const { token } = await makeActor();
    const foreign = await makeMessage(new mongoose.Types.ObjectId());
    const res = await request(app).get(`${PREFIX}/emails/${foreign.id}`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('EMAIL_NOT_FOUND');
  });
});

describe('POST /emails/:id/retry', () => {
  it('re-attempts a failed message (ends skipped with no provider configured)', async () => {
    const { token, org } = await makeActor();
    const message = await makeMessage(org, {
      status: EMAIL_STATUS.FAILED,
      attempts: 1,
      attachPdf: false,
      lastError: 'boom',
    });

    const res = await request(app).post(`${PREFIX}/emails/${message.id}/retry`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.email.status).toBe(EMAIL_STATUS.SKIPPED);
    expect(res.body.data.email.attempts).toBe(2);
  });

  it('400s EMAIL_ALREADY_SENT when the message was already sent', async () => {
    const { token, org } = await makeActor();
    const message = await makeMessage(org, { status: EMAIL_STATUS.SENT });
    const res = await request(app).post(`${PREFIX}/emails/${message.id}/retry`).set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_ALREADY_SENT');
  });

  it('404s a retry for a message in another org (isolation)', async () => {
    const { token } = await makeActor();
    const foreign = await makeMessage(new mongoose.Types.ObjectId(), { status: EMAIL_STATUS.FAILED });
    const res = await request(app).post(`${PREFIX}/emails/${foreign.id}/retry`).set(bearer(token));
    expect(res.status).toBe(404);
  });
});
