/**
 * Auth hardening & edge cases (Task 6).
 *
 * Complements the happy-path suites with adversarial inputs and boundary
 * conditions: expired/wrong-type tokens, revoked-by-state accounts, deleted
 * users, password-change invalidation, malformed request bodies, and the
 * presence of security headers.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import { signAccessToken, signRefreshToken } from '../src/utils/token.js';
import { USER_STATUS } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

const validUser = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'Sup3rSecret',
};

async function registerUser(overrides = {}) {
  return request(app)
    .post(`${PREFIX}/auth/register`)
    .send({ ...validUser, ...overrides });
}

describe('Access-token edge cases (GET /auth/me)', () => {
  it('rejects an expired access token with 401 TOKEN_EXPIRED', async () => {
    const user = await User.create({ ...validUser });
    const expired = jwt.sign(
      { sub: user._id.toString(), role: user.role, type: 'access' },
      ACCESS_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a refresh token presented as a Bearer access token (401)', async () => {
    const user = await User.create({ ...validUser });
    const refresh = signRefreshToken(user); // signed with the refresh secret
    const res = await request(app)
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${refresh}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('forbids a suspended account even with a valid token (403)', async () => {
    const user = await User.create({ ...validUser });
    const token = signAccessToken(user);
    await User.updateOne({ _id: user._id }, { status: USER_STATUS.SUSPENDED });

    const res = await request(app)
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('rejects a token issued before the last password change (401 PASSWORD_CHANGED)', async () => {
    const user = await User.create({ ...validUser });
    // Token minted 10s in the past — clearly before the upcoming change. (The
    // model backdates passwordChangedAt by 1s, so a token from the *same* second
    // as a change intentionally stays valid; this token predates that window.)
    const nowSec = Math.floor(Date.now() / 1000);
    const oldToken = jwt.sign(
      { sub: user._id.toString(), role: user.role, type: 'access', iat: nowSec - 10, exp: nowSec + 900 },
      ACCESS_SECRET
    );

    const fresh = await User.findById(user._id).select('+password');
    fresh.password = 'A whole new Pass1';
    await fresh.save(); // pre-save hook advances passwordChangedAt to ~now-1s

    const res = await request(app)
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${oldToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('PASSWORD_CHANGED');
  });
});

describe('Refresh-token edge cases (POST /auth/refresh)', () => {
  it('rejects an access token presented as a refresh token (401)', async () => {
    const user = await User.create({ ...validUser });
    const access = signAccessToken(user); // wrong secret for the refresh verify
    const res = await request(app)
      .post(`${PREFIX}/auth/refresh`)
      .send({ refreshToken: access });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('rejects a well-signed refresh token whose user no longer exists (401)', async () => {
    const user = await User.create({ ...validUser });
    const refresh = signRefreshToken(user);
    await User.deleteOne({ _id: user._id });

    const res = await request(app).post(`${PREFIX}/auth/refresh`).send({ refreshToken: refresh });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('forbids refresh for a suspended account (403)', async () => {
    const reg = await registerUser();
    const refreshToken = reg.body.data.refreshToken;
    await User.updateOne({ email: validUser.email }, { status: USER_STATUS.SUSPENDED });

    const res = await request(app).post(`${PREFIX}/auth/refresh`).send({ refreshToken });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('Registration hardening', () => {
  it('treats emails case-insensitively for duplicate detection (409)', async () => {
    await registerUser({ email: 'ADA@Example.com' });
    const res = await registerUser({ email: 'ada@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });
});

describe('Request-body hardening', () => {
  it('returns 400 INVALID_JSON for a malformed JSON body (not 500)', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{ "email": "ada@example.com", '); // truncated / invalid JSON
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });
});

describe('Security headers', () => {
  it('sets helmet hardening headers and hides x-powered-by', async () => {
    const res = await request(app).get(`${PREFIX}/health`);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
