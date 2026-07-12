/**
 * Notification API (Module 13): GET /notifications, GET /notifications/unread-count,
 * PATCH /notifications/:id/read, POST /notifications/read-all, DELETE /notifications/:id.
 * Covers recipient scoping (you only ever see/touch your own), tenant isolation,
 * read/unread filtering, the mark-read + mark-all-read + delete flows, and the
 * approval → notification wiring.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Document from '../src/features/documents/document.model.js';
import Notification from '../src/features/notifications/notification.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, NOTIFICATION_TYPE } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser({ role = ROLES.MEMBER, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'No',
    lastName: 'Tify',
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

function makeNotification(org, recipient, overrides = {}) {
  return Notification.create({
    organization: org,
    recipient,
    title: 'Something happened',
    ...overrides,
  });
}

describe('GET /notifications', () => {
  it('lists only the caller\'s own notifications, newest first', async () => {
    const { token, org, user } = await makeUser();
    await makeNotification(org, user.id, { title: 'First' });
    await makeNotification(org, user.id, { title: 'Second' });
    // Another user in the same org — must NOT appear.
    const other = await makeUser({ organization: org });
    await makeNotification(org, other.user.id, { title: 'Not mine' });

    const res = await request(app).get(`${PREFIX}/notifications`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.notifications[0].title).toBe('Second');
  });

  it('filters by read status', async () => {
    const { token, org, user } = await makeUser();
    await makeNotification(org, user.id, { title: 'Unread one' });
    await makeNotification(org, user.id, { title: 'Read one', readAt: new Date() });

    const unread = await request(app)
      .get(`${PREFIX}/notifications`)
      .query({ status: 'unread' })
      .set(bearer(token));
    expect(unread.body.data.notifications).toHaveLength(1);
    expect(unread.body.data.notifications[0].title).toBe('Unread one');

    const read = await request(app)
      .get(`${PREFIX}/notifications`)
      .query({ status: 'read' })
      .set(bearer(token));
    expect(read.body.data.notifications).toHaveLength(1);
    expect(read.body.data.notifications[0].title).toBe('Read one');
  });

  it('filters by type', async () => {
    const { token, org, user } = await makeUser();
    await makeNotification(org, user.id, { type: NOTIFICATION_TYPE.APPROVAL_REQUESTED });
    await makeNotification(org, user.id, { type: NOTIFICATION_TYPE.SYSTEM });

    const res = await request(app)
      .get(`${PREFIX}/notifications`)
      .query({ type: NOTIFICATION_TYPE.APPROVAL_REQUESTED })
      .set(bearer(token));

    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.notifications[0].type).toBe(NOTIFICATION_TYPE.APPROVAL_REQUESTED);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get(`${PREFIX}/notifications`);
    expect(res.status).toBe(401);
  });
});

describe('GET /notifications/unread-count', () => {
  it('counts only the caller\'s unread notifications', async () => {
    const { token, org, user } = await makeUser();
    await makeNotification(org, user.id);
    await makeNotification(org, user.id);
    await makeNotification(org, user.id, { readAt: new Date() });

    const res = await request(app).get(`${PREFIX}/notifications/unread-count`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.unread).toBe(2);
  });
});

describe('PATCH /notifications/:id/read', () => {
  it('marks a notification read', async () => {
    const { token, org, user } = await makeUser();
    const notification = await makeNotification(org, user.id);

    const res = await request(app)
      .patch(`${PREFIX}/notifications/${notification.id}/read`)
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.notification.readAt).not.toBeNull();
  });

  it('404s for another user\'s notification (recipient isolation)', async () => {
    const { token, org } = await makeUser();
    const other = await makeUser({ organization: org });
    const foreign = await makeNotification(org, other.user.id);

    const res = await request(app)
      .patch(`${PREFIX}/notifications/${foreign.id}/read`)
      .set(bearer(token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOTIFICATION_NOT_FOUND');
  });
});

describe('POST /notifications/read-all', () => {
  it('marks all the caller\'s unread notifications read', async () => {
    const { token, org, user } = await makeUser();
    await makeNotification(org, user.id);
    await makeNotification(org, user.id);
    await makeNotification(org, user.id, { readAt: new Date() });

    const res = await request(app).post(`${PREFIX}/notifications/read-all`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(2);

    const remaining = await Notification.countDocuments({ recipient: user.id, readAt: null });
    expect(remaining).toBe(0);
  });
});

describe('DELETE /notifications/:id', () => {
  it('deletes the caller\'s own notification', async () => {
    const { token, org, user } = await makeUser();
    const notification = await makeNotification(org, user.id);

    const res = await request(app)
      .delete(`${PREFIX}/notifications/${notification.id}`)
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(await Notification.findById(notification.id)).toBeNull();
  });

  it('404s for another user\'s notification', async () => {
    const { token, org } = await makeUser();
    const other = await makeUser({ organization: org });
    const foreign = await makeNotification(org, other.user.id);

    const res = await request(app)
      .delete(`${PREFIX}/notifications/${foreign.id}`)
      .set(bearer(token));

    expect(res.status).toBe(404);
  });
});

describe('approval → notification wiring', () => {
  it('notifies each approver when a document is routed for approval', async () => {
    const requester = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ organization: requester.org });
    const document = await Document.create({
      organization: requester.org,
      title: 'Contract',
      content: 'body',
    });

    const res = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(requester.token))
      .send({ documentId: document.id, approverIds: [approver.user.id], note: 'Please review' });
    expect(res.status).toBe(201);

    const inbox = await Notification.find({ recipient: approver.user.id });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].type).toBe(NOTIFICATION_TYPE.APPROVAL_REQUESTED);
    expect(inbox[0].link).toBe(`/documents/${document.id}`);
    expect(String(inbox[0].actor)).toBe(requester.user.id);
  });

  it('notifies the requester when their request is decided', async () => {
    const requester = await makeUser({ role: ROLES.ADMIN });
    const approver = await makeUser({ role: ROLES.MANAGER, organization: requester.org });
    const document = await Document.create({
      organization: requester.org,
      title: 'Contract',
      content: 'body',
    });

    const created = await request(app)
      .post(`${PREFIX}/approvals`)
      .set(bearer(requester.token))
      .send({ documentId: document.id, approverIds: [approver.user.id] });

    await request(app)
      .post(`${PREFIX}/approvals/${created.body.data.approval.id}/decision`)
      .set(bearer(approver.token))
      .send({ decision: 'approve' });

    const inbox = await Notification.find({
      recipient: requester.user.id,
      type: NOTIFICATION_TYPE.APPROVAL_APPROVED,
    });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].link).toBe(`/documents/${document.id}`);
  });
});
