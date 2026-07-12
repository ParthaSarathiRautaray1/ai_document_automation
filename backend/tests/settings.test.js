/**
 * Settings endpoints (Module 17): /settings/me, /settings/me/password,
 * /settings/organization. Exercises auth, self-scoped account settings, the
 * password-change flow (session revocation), preference validation, and the
 * org-preferences permission gate.
 */
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Organization from '../src/features/organizations/organization.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, DEFAULT_THEME } from '../src/config/constants.js';

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

describe('GET /settings/me', () => {
  it('requires authentication (401)', async () => {
    const res = await request(app).get(`${PREFIX}/settings/me`);
    expect(res.status).toBe(401);
  });

  it('returns the caller with default preferences', async () => {
    const { accessToken, user } = await registerOwner();
    const res = await request(app).get(`${PREFIX}/settings/me`).set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user.preferences.theme).toBe(DEFAULT_THEME);
    expect(res.body.data.user.preferences.notifications.email).toBe(true);
    expect(res.body.data.user.password).toBeUndefined();
  });
});

describe('PATCH /settings/me', () => {
  it('updates profile name and preferences (partial merge)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/settings/me`)
      .set(bearer(accessToken))
      .send({
        firstName: 'Renamed',
        preferences: { theme: 'dark', notifications: { email: false } },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe('Renamed');
    expect(res.body.data.user.preferences.theme).toBe('dark');
    expect(res.body.data.user.preferences.notifications.email).toBe(false);
    // Untouched keys keep their defaults.
    expect(res.body.data.user.preferences.notifications.approvals).toBe(true);
    expect(res.body.data.user.preferences.dateFormat).toBe('MMM D, YYYY');
  });

  it('rejects an empty body (422)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app).patch(`${PREFIX}/settings/me`).set(bearer(accessToken)).send({});
    expect(res.status).toBe(422);
  });

  it('rejects an unknown theme (422)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/settings/me`)
      .set(bearer(accessToken))
      .send({ preferences: { theme: 'neon' } });
    expect(res.status).toBe(422);
  });

  it('rejects unknown preference keys (strict, 422)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/settings/me`)
      .set(bearer(accessToken))
      .send({ preferences: { bogus: true } });
    expect(res.status).toBe(422);
  });
});

describe('POST /settings/me/password', () => {
  it('changes the password and revokes sessions', async () => {
    const { accessToken } = await registerOwner('pw@example.com');

    const change = await request(app)
      .post(`${PREFIX}/settings/me/password`)
      .set(bearer(accessToken))
      .send({ currentPassword: 'Sup3rSecret', newPassword: 'BrandN3wPass' });
    expect(change.status).toBe(200);

    // The refresh session was revoked immediately (hash cleared).
    const revoked = await User.findOne({ email: 'pw@example.com' }).select('+refreshTokenHash');
    expect(revoked.refreshTokenHash).toBeNull();

    // New password logs in.
    const login = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: 'pw@example.com', password: 'BrandN3wPass' });
    expect(login.status).toBe(200);

    // Old password no longer works.
    const stale = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: 'pw@example.com', password: 'Sup3rSecret' });
    expect(stale.status).toBe(401);
  });

  it('rejects a wrong current password (400)', async () => {
    const { accessToken } = await registerOwner('pw2@example.com');
    const res = await request(app)
      .post(`${PREFIX}/settings/me/password`)
      .set(bearer(accessToken))
      .send({ currentPassword: 'wrongwrong', newPassword: 'BrandN3wPass' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('rejects reusing the current password (400)', async () => {
    const { accessToken } = await registerOwner('pw3@example.com');
    const res = await request(app)
      .post(`${PREFIX}/settings/me/password`)
      .set(bearer(accessToken))
      .send({ currentPassword: 'Sup3rSecret', newPassword: 'Sup3rSecret' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_UNCHANGED');
  });

  it('rejects a too-short new password (422)', async () => {
    const { accessToken } = await registerOwner('pw4@example.com');
    const res = await request(app)
      .post(`${PREFIX}/settings/me/password`)
      .set(bearer(accessToken))
      .send({ currentPassword: 'Sup3rSecret', newPassword: 'short' });
    expect(res.status).toBe(422);
  });
});

describe('GET /settings/organization', () => {
  it('returns the org preferences with defaults', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app).get(`${PREFIX}/settings/organization`).set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.settings.defaultCurrency).toBe('USD');
    expect(res.body.data.settings.branding.primaryColor).toMatch(/^#/);
  });

  it('returns 404 NO_ORGANIZATION when the user has none', async () => {
    const { token } = await makeUser({ email: 'orphan@example.com', role: ROLES.ADMIN });
    const res = await request(app).get(`${PREFIX}/settings/organization`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_ORGANIZATION');
  });
});

describe('PATCH /settings/organization', () => {
  it('lets an admin update org preferences', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/settings/organization`)
      .set(bearer(accessToken))
      .send({
        defaultCurrency: 'eur',
        defaultDocumentType: 'invoice',
        branding: { primaryColor: '#112233' },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.defaultCurrency).toBe('EUR'); // upper-cased
    expect(res.body.data.settings.defaultDocumentType).toBe('invoice');
    expect(res.body.data.settings.branding.primaryColor).toBe('#112233');
    // Untouched branding key keeps its default.
    expect(res.body.data.settings.branding.accentColor).toMatch(/^#/);
  });

  it('rejects an invalid hex colour (422)', async () => {
    const { accessToken } = await registerOwner();
    const res = await request(app)
      .patch(`${PREFIX}/settings/organization`)
      .set(bearer(accessToken))
      .send({ branding: { primaryColor: 'red' } });
    expect(res.status).toBe(422);
  });

  it('forbids a member without org:update (403)', async () => {
    const org = await Organization.create({
      name: 'Foo',
      owner: (await makeUser({ email: 'x@e.com' })).user._id,
    });
    const { token } = await makeUser({
      email: 'member@example.com',
      role: ROLES.MEMBER,
      organization: org._id,
    });
    const res = await request(app)
      .patch(`${PREFIX}/settings/organization`)
      .set(bearer(token))
      .send({ defaultCurrency: 'GBP' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('allows a member to read org preferences (org:read, 200)', async () => {
    const org = await Organization.create({
      name: 'Bar',
      owner: (await makeUser({ email: 'y@e.com' })).user._id,
    });
    const { token } = await makeUser({
      email: 'reader@example.com',
      role: ROLES.MEMBER,
      organization: org._id,
    });
    const res = await request(app).get(`${PREFIX}/settings/organization`).set(bearer(token));
    expect(res.status).toBe(200);
  });
});
