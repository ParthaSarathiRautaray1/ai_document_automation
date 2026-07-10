/**
 * Member management (Module 3 · Task 5):
 *   POST /organizations/members/invite, DELETE /organizations/members/:id.
 * Email delivery is SKIPPED in tests (no BREVO_API_KEY), so invites succeed
 * without an outbound call. Covers the permission gate, hierarchy/escalation
 * guards, tenant isolation, and the invited-account login block.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Organization from '../src/features/organizations/organization.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function registerOwner(email = 'owner@example.com') {
  const res = await request(app)
    .post(`${PREFIX}/auth/register`)
    .send({ firstName: 'Owner', lastName: 'User', email, password: 'Sup3rSecret', organizationName: 'Acme' });
  return res.body.data;
}

async function makeUser({ email, role = ROLES.MEMBER, status = USER_STATUS.ACTIVE, organization }) {
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

describe('POST /organizations/members/invite', () => {
  it('lets an admin invite a member (invited status, same org, no secret leak)', async () => {
    const { accessToken, organization, user } = await registerOwner();
    const res = await request(app)
      .post(`${PREFIX}/organizations/members/invite`)
      .set(bearer(accessToken))
      .send({ firstName: 'New', lastName: 'Hire', email: 'newhire@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.member.status).toBe(USER_STATUS.INVITED);
    expect(res.body.data.member.role).toBe(ROLES.MEMBER);
    expect(res.body.data.member.organization).toBe(organization.id);
    expect(res.body.data.member.password).toBeUndefined();
    expect(res.body.data.member.passwordResetToken).toBeUndefined();
    // Inviter unaffected.
    expect(user.role).toBe(ROLES.ADMIN);
  });

  it('lets an admin invite a manager (role strictly below the inviter)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .post(`${PREFIX}/organizations/members/invite`)
      .set(bearer(accessToken))
      .send({ firstName: 'Mid', lastName: 'Level', email: 'mgr@example.com', role: ROLES.MANAGER });
    expect(res.status).toBe(201);
    expect(res.body.data.member.role).toBe(ROLES.MANAGER);
  });

  it('forbids inviting a role at or above the inviter (403 ROLE_ASSIGNMENT_FORBIDDEN)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .post(`${PREFIX}/organizations/members/invite`)
      .set(bearer(accessToken))
      .send({ firstName: 'Too', lastName: 'High', email: 'admin2@example.com', role: ROLES.ADMIN });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_ASSIGNMENT_FORBIDDEN');
  });

  it('rejects a duplicate email (409 EMAIL_TAKEN)', async () => {
    const { accessToken } = await registerOwner();
    await makeUser({ email: 'dupe@example.com', organization: new mongoose.Types.ObjectId() });
    const res = await request(app)
      .post(`${PREFIX}/organizations/members/invite`)
      .set(bearer(accessToken))
      .send({ firstName: 'D', lastName: 'U', email: 'dupe@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('forbids a member without org:manage_members (403 FORBIDDEN_PERMISSION)', async () => {
    const org = await Organization.create({ name: 'Foo', owner: (await makeUser({ email: 'o@e.com' })).user._id });
    const { token } = await makeUser({ email: 'plain@example.com', role: ROLES.MEMBER, organization: org._id });
    const res = await request(app)
      .post(`${PREFIX}/organizations/members/invite`)
      .set(bearer(token))
      .send({ firstName: 'X', lastName: 'Y', email: 'z@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('blocks an invited account from logging in (403 ACCOUNT_INVITED)', async () => {
    await makeUser({ email: 'pending@example.com', status: USER_STATUS.INVITED });
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: 'pending@example.com', password: 'Sup3rSecret' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_INVITED');
  });
});

describe('DELETE /organizations/members/:id', () => {
  it('lets an admin remove a member', async () => {
    const { accessToken, organization } = await registerOwner();
    const { user: target } = await makeUser({ email: 'gone@example.com', organization: organization.id });

    const res = await request(app)
      .delete(`${PREFIX}/organizations/members/${target.id}`)
      .set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(await User.findById(target.id)).toBeNull();
  });

  it('blocks removing yourself (403 CANNOT_MODIFY_SELF)', async () => {
    const { accessToken, user } = await registerOwner();
    const res = await request(app)
      .delete(`${PREFIX}/organizations/members/${user.id}`)
      .set(bearer(accessToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('blocks removing a peer/superior (403 FORBIDDEN_TARGET)', async () => {
    const { accessToken, organization } = await registerOwner();
    const { user: peer } = await makeUser({ email: 'peer@example.com', role: ROLES.ADMIN, organization: organization.id });
    const res = await request(app)
      .delete(`${PREFIX}/organizations/members/${peer.id}`)
      .set(bearer(accessToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TARGET');
  });

  it('returns 404 for a member in another organization (isolation)', async () => {
    const { accessToken } = await registerOwner();
    const { user: foreign } = await makeUser({ email: 'foreign@example.com', organization: new mongoose.Types.ObjectId() });
    const res = await request(app)
      .delete(`${PREFIX}/organizations/members/${foreign.id}`)
      .set(bearer(accessToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('forbids a member without org:manage_members (403 FORBIDDEN_PERMISSION)', async () => {
    const org = await Organization.create({ name: 'Bar', owner: (await makeUser({ email: 'o2@e.com' })).user._id });
    const actor = await makeUser({ email: 'nobody@example.com', role: ROLES.MEMBER, organization: org._id });
    const { user: target } = await makeUser({ email: 't@example.com', organization: org._id });
    const res = await request(app)
      .delete(`${PREFIX}/organizations/members/${target.id}`)
      .set(bearer(actor.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});
