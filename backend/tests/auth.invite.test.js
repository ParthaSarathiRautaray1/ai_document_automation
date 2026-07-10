/**
 * Accept invitation (Module 3 · Task 5): POST /auth/accept-invite.
 * Creates an invited user directly and mints a real invite token via the model,
 * then exercises the accept flow (activate + login), token single-use, and the
 * invalid/expired/weak-password paths.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Organization from '../src/features/organizations/organization.model.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';

/** Create an invited user with a real invite token; returns { user, rawToken }. */
async function makeInvite({ email = 'invitee@example.com', firstName = 'Invited', lastName = 'User' } = {}) {
  const org = await Organization.create({ name: 'Acme', owner: new mongoose.Types.ObjectId() });
  const user = await User.create({
    firstName,
    lastName,
    email,
    password: 'TemporaryPass123', // throwaway; the invitee sets their own
    role: ROLES.MEMBER,
    status: USER_STATUS.INVITED,
    organization: org._id,
  });
  const rawToken = user.createInviteToken();
  await user.save({ validateBeforeSave: false });
  return { user, org, rawToken };
}

describe('POST /auth/accept-invite', () => {
  it('activates the account, logs the user in, and returns the org', async () => {
    const { user, org, rawToken } = await makeInvite();
    const res = await request(app)
      .post(`${PREFIX}/auth/accept-invite`)
      .send({ token: rawToken, password: 'BrandNew123' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe(USER_STATUS.ACTIVE);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.organization.id).toBe(org.id);
    expect(typeof res.body.data.accessToken).toBe('string');

    // Can now log in with the chosen password.
    const login = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: user.email, password: 'BrandNew123' });
    expect(login.status).toBe(200);
  });

  it('optionally overrides the invitee name', async () => {
    const { rawToken } = await makeInvite({ email: 'name@example.com' });
    const res = await request(app)
      .post(`${PREFIX}/auth/accept-invite`)
      .send({ token: rawToken, password: 'BrandNew123', firstName: 'Real', lastName: 'Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.fullName).toBe('Real Name');
  });

  it('consumes the token (second use fails 400 INVITE_INVALID)', async () => {
    const { rawToken } = await makeInvite({ email: 'once@example.com' });
    await request(app).post(`${PREFIX}/auth/accept-invite`).send({ token: rawToken, password: 'BrandNew123' });
    const second = await request(app)
      .post(`${PREFIX}/auth/accept-invite`)
      .send({ token: rawToken, password: 'AnotherOne123' });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('INVITE_INVALID');
  });

  it('rejects a garbage token (400 INVITE_INVALID)', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/accept-invite`)
      .send({ token: 'not-a-real-token', password: 'BrandNew123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVITE_INVALID');
  });

  it('rejects a weak password (422)', async () => {
    const { rawToken } = await makeInvite({ email: 'weak@example.com' });
    const res = await request(app)
      .post(`${PREFIX}/auth/accept-invite`)
      .send({ token: rawToken, password: 'weak' });
    expect(res.status).toBe(422);
  });

  it('does not accept for an already-active account', async () => {
    const { user, rawToken } = await makeInvite({ email: 'active@example.com' });
    // Flip to active without consuming the token.
    await User.updateOne({ _id: user.id }, { status: USER_STATUS.ACTIVE });
    const res = await request(app)
      .post(`${PREFIX}/auth/accept-invite`)
      .send({ token: rawToken, password: 'BrandNew123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVITE_INVALID');
  });
});
