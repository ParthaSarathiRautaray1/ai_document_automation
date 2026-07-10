/**
 * Role & status mutation (Module 2 · Task 3):
 *   PATCH /users/:id/role, PATCH /users/:id/status.
 *
 * Covers the permission gate, the hierarchy guards (no self-modify, no touching
 * peers/superiors, no role escalation), suspend session-revocation, and the
 * 404/422 paths.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';

// Shared tenant: user administration is org-scoped (Module 3), so actor and
// target must belong to the same organization to be manageable.
const ORG = new mongoose.Types.ObjectId();

async function makeUser({ email, role = ROLES.MEMBER, status = USER_STATUS.ACTIVE, organization = ORG }) {
  const user = await User.create({
    firstName: 'T',
    lastName: 'U',
    email,
    password: 'Sup3rSecret',
    role,
    status,
    organization,
  });
  return { user, token: signAccessToken(user) };
}

/** Register through the API to obtain real access + refresh tokens. */
async function registerUser(email) {
  const res = await request(app)
    .post(`${PREFIX}/auth/register`)
    .send({ firstName: 'Reg', lastName: 'User', email, password: 'Sup3rSecret' });
  return res.body.data; // { user, accessToken, refreshToken }
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('PATCH /users/:id/role', () => {
  it('lets an admin promote a member to manager', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const { user: target } = await makeUser({ email: 'm@example.com', role: ROLES.MEMBER });

    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/role`)
      .set(bearer(token))
      .send({ role: ROLES.MANAGER });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe(ROLES.MANAGER);
  });

  it('forbids a member without user:update_role (403 FORBIDDEN_PERMISSION)', async () => {
    const { token } = await makeUser({ email: 'member@example.com', role: ROLES.MEMBER });
    const { user: target } = await makeUser({ email: 't@example.com' });
    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/role`)
      .set(bearer(token))
      .send({ role: ROLES.MANAGER });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('blocks changing your own role (403 CANNOT_MODIFY_SELF)', async () => {
    const { user, token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const res = await request(app)
      .patch(`${PREFIX}/users/${user.id}/role`)
      .set(bearer(token))
      .send({ role: ROLES.MEMBER });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('blocks modifying a peer/superior (403 FORBIDDEN_TARGET)', async () => {
    const { token } = await makeUser({ email: 'admin1@example.com', role: ROLES.ADMIN });
    const { user: otherAdmin } = await makeUser({ email: 'admin2@example.com', role: ROLES.ADMIN });
    const res = await request(app)
      .patch(`${PREFIX}/users/${otherAdmin.id}/role`)
      .set(bearer(token))
      .send({ role: ROLES.MANAGER });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TARGET');
  });

  it('blocks assigning a role at or above your own (403 ROLE_ASSIGNMENT_FORBIDDEN)', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const { user: target } = await makeUser({ email: 'm@example.com', role: ROLES.MEMBER });
    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/role`)
      .set(bearer(token))
      .send({ role: ROLES.ADMIN }); // equal to actor's rank → forbidden
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_ASSIGNMENT_FORBIDDEN');
  });

  it('lets a super_admin promote a member to admin', async () => {
    const { token } = await makeUser({ email: 'super@example.com', role: ROLES.SUPER_ADMIN });
    const { user: target } = await makeUser({ email: 'm@example.com', role: ROLES.MEMBER });
    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/role`)
      .set(bearer(token))
      .send({ role: ROLES.ADMIN });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe(ROLES.ADMIN);
  });

  it('forbids even a super_admin from minting another super_admin (no rank above)', async () => {
    const { token } = await makeUser({ email: 'super@example.com', role: ROLES.SUPER_ADMIN });
    const { user: target } = await makeUser({ email: 'm@example.com', role: ROLES.MEMBER });
    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/role`)
      .set(bearer(token))
      .send({ role: ROLES.SUPER_ADMIN });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_ASSIGNMENT_FORBIDDEN');
  });

  it('returns 404 for a non-existent target', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const res = await request(app)
      .patch(`${PREFIX}/users/0123456789abcdef01234567/role`)
      .set(bearer(token))
      .send({ role: ROLES.MANAGER });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('rejects an invalid role value (422)', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const { user: target } = await makeUser({ email: 'm@example.com' });
    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/role`)
      .set(bearer(token))
      .send({ role: 'wizard' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /users/:id/status', () => {
  it('lets an admin suspend a member and revokes their session', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    // Register to obtain a real refresh token, then demote to member so the admin
    // actor may suspend them (self-serve registrants are org-owner admins now).
    const target = await registerUser('victim@example.com');
    // Move them into the actor's org and demote to member so the admin may act.
    await User.updateOne({ _id: target.user.id }, { role: ROLES.MEMBER, organization: ORG });

    const res = await request(app)
      .patch(`${PREFIX}/users/${target.user.id}/status`)
      .set(bearer(token))
      .send({ status: USER_STATUS.SUSPENDED });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe(USER_STATUS.SUSPENDED);

    // Their existing access token is now rejected on protected routes.
    const me = await request(app).get(`${PREFIX}/auth/me`).set(bearer(target.accessToken));
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('ACCOUNT_SUSPENDED');

    // Their refresh token no longer works either.
    const refresh = await request(app)
      .post(`${PREFIX}/auth/refresh`)
      .send({ refreshToken: target.refreshToken });
    expect(refresh.status).toBe(403);
    expect(refresh.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('lets an admin reactivate a suspended member', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const { user: target } = await makeUser({ email: 'sus@example.com', status: USER_STATUS.SUSPENDED });

    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/status`)
      .set(bearer(token))
      .send({ status: USER_STATUS.ACTIVE });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe(USER_STATUS.ACTIVE);
  });

  it('forbids a member without user:update_status (403 FORBIDDEN_PERMISSION)', async () => {
    const { token } = await makeUser({ email: 'member@example.com', role: ROLES.MEMBER });
    const { user: target } = await makeUser({ email: 't@example.com' });
    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/status`)
      .set(bearer(token))
      .send({ status: USER_STATUS.SUSPENDED });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('blocks suspending yourself (403 CANNOT_MODIFY_SELF)', async () => {
    const { user, token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const res = await request(app)
      .patch(`${PREFIX}/users/${user.id}/status`)
      .set(bearer(token))
      .send({ status: USER_STATUS.SUSPENDED });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('blocks suspending a peer/superior (403 FORBIDDEN_TARGET)', async () => {
    const { token } = await makeUser({ email: 'admin1@example.com', role: ROLES.ADMIN });
    const { user: otherAdmin } = await makeUser({ email: 'admin2@example.com', role: ROLES.ADMIN });
    const res = await request(app)
      .patch(`${PREFIX}/users/${otherAdmin.id}/status`)
      .set(bearer(token))
      .send({ status: USER_STATUS.SUSPENDED });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TARGET');
  });

  it('rejects an invalid status value (422)', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const { user: target } = await makeUser({ email: 'm@example.com' });
    const res = await request(app)
      .patch(`${PREFIX}/users/${target.id}/status`)
      .set(bearer(token))
      .send({ status: 'banned' });
    expect(res.status).toBe(422);
  });
});
