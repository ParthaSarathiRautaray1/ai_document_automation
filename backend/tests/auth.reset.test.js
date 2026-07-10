/**
 * Password reset flow (Task 4): forgot-password + reset-password.
 *
 * The email service is mocked so the suite stays hermetic (no outbound calls)
 * and so we can capture the reset URL — the only place the plaintext token is
 * normally exposed — to drive the reset step.
 */
import { jest } from '@jest/globals';

const sendPasswordResetEmail = jest.fn().mockResolvedValue({ delivered: true });

jest.unstable_mockModule('../src/services/email.service.js', () => ({
  sendPasswordResetEmail,
  sendInvitationEmail: jest.fn().mockResolvedValue({ delivered: true }),
  sendTransactionalEmail: jest.fn().mockResolvedValue({ delivered: true }),
}));

// Import AFTER registering the mock so the auth service binds to the mock.
const request = (await import('supertest')).default;
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/features/users/user.model.js');

const PREFIX = process.env.API_PREFIX || '/api/v1';

const validUser = {
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  password: 'Sup3rSecret',
};

async function registerUser(overrides = {}) {
  return request(app)
    .post(`${PREFIX}/auth/register`)
    .send({ ...validUser, ...overrides });
}

/** Pull the plaintext token out of the URL passed to the mocked email sender. */
function tokenFromLastEmail() {
  const [, resetUrl] = sendPasswordResetEmail.mock.calls.at(-1);
  return new URL(resetUrl).searchParams.get('token');
}

describe('POST /auth/forgot-password', () => {
  it('sends a reset email for a known account (generic 200)', async () => {
    await registerUser();
    const res = await request(app)
      .post(`${PREFIX}/auth/forgot-password`)
      .send({ email: validUser.email });

    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(tokenFromLastEmail()).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same generic 200 for an unknown account and sends nothing', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/forgot-password`)
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('rejects an invalid email (422 validation)', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/forgot-password`)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

describe('POST /auth/reset-password', () => {
  it('resets the password with a valid token and lets the user log in with it', async () => {
    await registerUser();
    await request(app).post(`${PREFIX}/auth/forgot-password`).send({ email: validUser.email });
    const token = tokenFromLastEmail();

    const reset = await request(app)
      .post(`${PREFIX}/auth/reset-password`)
      .send({ token, password: 'BrandN3wPass' });
    expect(reset.status).toBe(200);

    // Old password no longer works.
    const oldLogin = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: validUser.email, password: validUser.password });
    expect(oldLogin.status).toBe(401);

    // New password works.
    const newLogin = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: validUser.email, password: 'BrandN3wPass' });
    expect(newLogin.status).toBe(200);
  });

  it('consumes the token — it cannot be reused', async () => {
    await registerUser();
    await request(app).post(`${PREFIX}/auth/forgot-password`).send({ email: validUser.email });
    const token = tokenFromLastEmail();

    await request(app).post(`${PREFIX}/auth/reset-password`).send({ token, password: 'BrandN3wPass' });
    const second = await request(app)
      .post(`${PREFIX}/auth/reset-password`)
      .send({ token, password: 'An0therPass' });

    expect(second.status).toBe(400);
    expect(second.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('revokes existing refresh sessions on reset', async () => {
    const reg = await registerUser();
    const oldRefresh = reg.body.data.refreshToken;

    await request(app).post(`${PREFIX}/auth/forgot-password`).send({ email: validUser.email });
    const token = tokenFromLastEmail();
    await request(app).post(`${PREFIX}/auth/reset-password`).send({ token, password: 'BrandN3wPass' });

    const refresh = await request(app)
      .post(`${PREFIX}/auth/refresh`)
      .send({ refreshToken: oldRefresh });
    expect(refresh.status).toBe(401);
  });

  it('rejects an unknown/garbage token (400 RESET_TOKEN_INVALID)', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/reset-password`)
      .send({ token: 'deadbeef'.repeat(8), password: 'BrandN3wPass' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects an expired token (400)', async () => {
    await registerUser();
    await request(app).post(`${PREFIX}/auth/forgot-password`).send({ email: validUser.email });
    const token = tokenFromLastEmail();

    // Force the stored token to have already expired.
    await User.updateOne(
      { email: validUser.email },
      { $set: { passwordResetExpires: new Date(Date.now() - 60_000) } }
    );

    const res = await request(app)
      .post(`${PREFIX}/auth/reset-password`)
      .send({ token, password: 'BrandN3wPass' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects a weak new password (422 validation)', async () => {
    await registerUser();
    await request(app).post(`${PREFIX}/auth/forgot-password`).send({ email: validUser.email });
    const token = tokenFromLastEmail();

    const res = await request(app)
      .post(`${PREFIX}/auth/reset-password`)
      .send({ token, password: 'weak' });
    expect(res.status).toBe(422);
  });
});
