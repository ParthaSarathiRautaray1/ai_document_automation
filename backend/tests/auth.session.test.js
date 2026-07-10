import request from 'supertest';
import app from '../src/app.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';

const validUser = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'Sup3rSecret',
};

async function registerUser() {
  const res = await request(app).post(`${PREFIX}/auth/register`).send(validUser);
  return res;
}

describe('Register/login token pair', () => {
  it('register returns both access and refresh tokens + sets refresh cookie', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => /HttpOnly/i.test(c))).toBe(true);
  });
});

describe('GET /auth/me (protected)', () => {
  it('rejects a request with no token (401 NO_TOKEN)', async () => {
    const res = await request(app).get(`${PREFIX}/auth/me`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('rejects a malformed/invalid token (401)', async () => {
    const res = await request(app)
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid access token', async () => {
    const reg = await registerUser();
    const res = await request(app)
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.password).toBeUndefined();
  });
});

describe('POST /auth/refresh (rotation)', () => {
  it('issues a new pair from a valid refresh token (body)', async () => {
    const reg = await registerUser();
    const oldRefresh = reg.body.data.refreshToken;

    const res = await request(app).post(`${PREFIX}/auth/refresh`).send({ refreshToken: oldRefresh });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(oldRefresh); // rotated
  });

  it('revokes the previous refresh token after rotation', async () => {
    const reg = await registerUser();
    const oldRefresh = reg.body.data.refreshToken;

    // First rotation succeeds.
    await request(app).post(`${PREFIX}/auth/refresh`).send({ refreshToken: oldRefresh });
    // Reusing the OLD token now fails.
    const reuse = await request(app).post(`${PREFIX}/auth/refresh`).send({ refreshToken: oldRefresh });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('REFRESH_REVOKED');
  });

  it('rejects a missing refresh token (401 NO_REFRESH_TOKEN)', async () => {
    const res = await request(app).post(`${PREFIX}/auth/refresh`).send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_REFRESH_TOKEN');
  });

  it('works via the httpOnly cookie using a persistent agent', async () => {
    const agent = request.agent(app);
    await agent.post(`${PREFIX}/auth/register`).send(validUser);
    const res = await agent.post(`${PREFIX}/auth/refresh`).send();
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const reg = await registerUser();
    const refreshToken = reg.body.data.refreshToken;

    const out = await request(app).post(`${PREFIX}/auth/logout`).send({ refreshToken });
    expect(out.status).toBe(200);

    const after = await request(app).post(`${PREFIX}/auth/refresh`).send({ refreshToken });
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('REFRESH_REVOKED');
  });

  it('is idempotent / safe with no token (200)', async () => {
    const res = await request(app).post(`${PREFIX}/auth/logout`).send({});
    expect(res.status).toBe(200);
  });
});
