/**
 * Organization endpoints (Module 3 · Task 3): GET/PATCH /organizations/me.
 * Exercises auth, permission gating (org:read / org:update), the update rules
 * (mutable fields, stable slug), and the no-organization path.
 */
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Organization from '../src/features/organizations/organization.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** Register through the API — yields an admin who owns a fresh organization. */
async function registerOwner(email = 'owner@example.com', organizationName = 'Acme Corp') {
  const res = await request(app)
    .post(`${PREFIX}/auth/register`)
    .send({ firstName: 'Owner', lastName: 'User', email, password: 'Sup3rSecret', organizationName });
  return res.body.data; // { user, organization, accessToken, refreshToken }
}

/** A directly-created user (control over role + organization). */
async function makeUser({ email, role = ROLES.MEMBER, organization = null }) {
  const user = await User.create({
    firstName: 'T',
    lastName: 'U',
    email,
    password: 'Sup3rSecret',
    role,
    organization,
  });
  return { user, token: signAccessToken(user) };
}

describe('GET /organizations/me', () => {
  it('requires authentication (401)', async () => {
    const res = await request(app).get(`${PREFIX}/organizations/me`);
    expect(res.status).toBe(401);
  });

  it("returns the caller's organization", async () => {
    const { accessToken, organization } = await registerOwner();
    const res = await request(app).get(`${PREFIX}/organizations/me`).set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.organization.id).toBe(organization.id);
    expect(res.body.data.organization.name).toBe('Acme Corp');
  });

  it('returns 404 NO_ORGANIZATION when the user has none', async () => {
    const { token } = await makeUser({ email: 'orphan@example.com', role: ROLES.MANAGER });
    const res = await request(app).get(`${PREFIX}/organizations/me`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_ORGANIZATION');
  });
});

describe('PATCH /organizations/me', () => {
  it('lets an admin update the name (slug stays stable)', async () => {
    const { accessToken, organization } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/organizations/me`)
      .set(bearer(accessToken))
      .send({ name: 'Acme Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.data.organization.name).toBe('Acme Renamed');
    expect(res.body.data.organization.slug).toBe(organization.slug); // unchanged
  });

  it('sets and clears the billing email', async () => {
    const { accessToken } = await registerOwner();
    const set = await request(app)
      .patch(`${PREFIX}/organizations/me`)
      .set(bearer(accessToken))
      .send({ billingEmail: 'BILLING@Acme.com' });
    expect(set.status).toBe(200);
    expect(set.body.data.organization.billingEmail).toBe('billing@acme.com');

    const clear = await request(app)
      .patch(`${PREFIX}/organizations/me`)
      .set(bearer(accessToken))
      .send({ billingEmail: null });
    expect(clear.status).toBe(200);
    expect(clear.body.data.organization.billingEmail).toBeNull();
  });

  it('updates a settings field', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/organizations/me`)
      .set(bearer(accessToken))
      .send({ settings: { timezone: 'Europe/Paris' } });
    expect(res.status).toBe(200);
    expect(res.body.data.organization.settings.timezone).toBe('Europe/Paris');
  });

  it('rejects an empty body (422)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app).patch(`${PREFIX}/organizations/me`).set(bearer(accessToken)).send({});
    expect(res.status).toBe(422);
  });

  it('rejects an invalid billing email (422)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/organizations/me`)
      .set(bearer(accessToken))
      .send({ billingEmail: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('forbids a member without org:update (403)', async () => {
    const org = await Organization.create({ name: 'Foo', owner: (await makeUser({ email: 'x@e.com' })).user._id });
    const { token } = await makeUser({ email: 'member@example.com', role: ROLES.MEMBER, organization: org._id });
    const res = await request(app)
      .patch(`${PREFIX}/organizations/me`)
      .set(bearer(token))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('GET /organizations/members', () => {
  it('lists only the members of the caller\'s organization', async () => {
    const { accessToken, user, organization } = await registerOwner('boss@example.com', 'Members Inc');
    // Two more members in the same org, plus one in a different org.
    await makeUser({ email: 'm1@example.com', organization: organization.id });
    await makeUser({ email: 'm2@example.com', organization: organization.id });
    await makeUser({ email: 'outsider@example.com', organization: undefined });

    const res = await request(app).get(`${PREFIX}/organizations/members`).set(bearer(accessToken));
    expect(res.status).toBe(200);
    // owner + m1 + m2 = 3; the outsider (other org) is excluded.
    expect(res.body.meta.total).toBe(3);
    const emails = res.body.data.members.map((m) => m.email);
    expect(emails).toContain(user.email);
    expect(emails).not.toContain('outsider@example.com');
  });

  it('forbids a member without user:read (403)', async () => {
    const org = await Organization.create({ name: 'Bar', owner: (await makeUser({ email: 'y@e.com' })).user._id });
    const { token } = await makeUser({ email: 'plain@example.com', role: ROLES.MEMBER, organization: org._id });
    const res = await request(app).get(`${PREFIX}/organizations/members`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});
