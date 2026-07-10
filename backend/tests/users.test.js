/**
 * User read API (Module 2 · Task 2): GET /users, GET /users/:id.
 * Exercises auth, permission gating, pagination, filtering, search, and the
 * 404/422 error paths against the real app.
 */
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';

/** Create a user directly and return { user, token }. */
async function makeUser({ email, role = ROLES.MEMBER, status = USER_STATUS.ACTIVE, firstName = 'Test', lastName = 'User' }) {
  const user = await User.create({ firstName, lastName, email, password: 'Sup3rSecret', role, status });
  return { user, token: signAccessToken(user) };
}

function auth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('GET /users (list)', () => {
  it('requires authentication (401 NO_TOKEN)', async () => {
    const res = await request(app).get(`${PREFIX}/users`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('forbids a member without user:read (403 FORBIDDEN_PERMISSION)', async () => {
    const { token } = await makeUser({ email: 'member@example.com', role: ROLES.MEMBER });
    const res = await auth(request(app).get(`${PREFIX}/users`), token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('allows a manager to list users and returns pagination meta', async () => {
    const { token } = await makeUser({ email: 'manager@example.com', role: ROLES.MANAGER });
    await makeUser({ email: 'a@example.com' });
    await makeUser({ email: 'b@example.com' });

    const res = await auth(request(app).get(`${PREFIX}/users`), token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    // manager + 2 created = 3
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 3, pages: 1 });
    // never leaks secrets
    expect(res.body.data.users.every((u) => u.password === undefined)).toBe(true);
  });

  it('paginates with page + limit', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    for (let i = 0; i < 4; i += 1) {
      await makeUser({ email: `u${i}@example.com` });
    }
    // 5 users total (admin + 4)
    const res = await auth(request(app).get(`${PREFIX}/users?page=1&limit=2`), token);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 5, pages: 3 });
  });

  it('filters by role', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    await makeUser({ email: 'm1@example.com', role: ROLES.MANAGER });
    await makeUser({ email: 'x@example.com', role: ROLES.MEMBER });

    const res = await auth(request(app).get(`${PREFIX}/users?role=manager`), token);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].role).toBe(ROLES.MANAGER);
  });

  it('filters by status', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    await makeUser({ email: 'sus@example.com', status: USER_STATUS.SUSPENDED });

    const res = await auth(request(app).get(`${PREFIX}/users?status=suspended`), token);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].status).toBe(USER_STATUS.SUSPENDED);
  });

  it('searches by name or email (case-insensitive)', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    await makeUser({ email: 'grace.hopper@navy.mil', firstName: 'Grace', lastName: 'Hopper' });

    const byEmail = await auth(request(app).get(`${PREFIX}/users?q=NAVY`), token);
    expect(byEmail.body.data.users).toHaveLength(1);
    expect(byEmail.body.data.users[0].email).toBe('grace.hopper@navy.mil');

    const byName = await auth(request(app).get(`${PREFIX}/users?q=grace`), token);
    expect(byName.body.data.users).toHaveLength(1);
  });

  it('rejects an unknown query field (strict schema, 422)', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const res = await auth(request(app).get(`${PREFIX}/users?bogus=1`), token);
    expect(res.status).toBe(422);
  });

  it('rejects an out-of-range limit (422)', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const res = await auth(request(app).get(`${PREFIX}/users?limit=500`), token);
    expect(res.status).toBe(422);
  });
});

describe('GET /users/:id', () => {
  it('returns a single user for an authorized caller', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const { user: target } = await makeUser({ email: 'target@example.com' });

    const res = await auth(request(app).get(`${PREFIX}/users/${target.id}`), token);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('target@example.com');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 404 for a valid but non-existent id', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const res = await auth(request(app).get(`${PREFIX}/users/0123456789abcdef01234567`), token);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('returns 422 for a malformed id', async () => {
    const { token } = await makeUser({ email: 'admin@example.com', role: ROLES.ADMIN });
    const res = await auth(request(app).get(`${PREFIX}/users/not-an-id`), token);
    expect(res.status).toBe(422);
  });

  it('forbids a member (403 FORBIDDEN_PERMISSION)', async () => {
    const { token } = await makeUser({ email: 'member@example.com', role: ROLES.MEMBER });
    const { user: target } = await makeUser({ email: 'target@example.com' });
    const res = await auth(request(app).get(`${PREFIX}/users/${target.id}`), token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});
