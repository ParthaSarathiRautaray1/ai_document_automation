/**
 * RBAC middleware (Task 5): authorize(...roles) and requireMinRole(role).
 *
 * Two layers:
 *  - Unit: call the middleware directly with a mock req/next to assert the
 *    branching (allow / 403 / 401) and config-time guards.
 *  - Integration: chain the REAL `authenticate` + RBAC + errorHandler on an
 *    inline Express app to prove end-to-end wiring and the 403/401 envelopes.
 */
import express from 'express';
import request from 'supertest';
import authenticate from '../src/middlewares/authenticate.js';
import { authorize, requireMinRole } from '../src/middlewares/authorize.js';
import errorHandler from '../src/middlewares/errorHandler.js';
import ApiError from '../src/utils/ApiError.js';
import User from '../src/features/users/user.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES } from '../src/config/constants.js';

/** Invoke a middleware once and resolve with whatever it passed to `next`. */
function run(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err));
  });
}

describe('authorize(...roles) — unit', () => {
  it('calls next() with no error when the role matches', async () => {
    const err = await run(authorize(ROLES.ADMIN), { user: { role: ROLES.ADMIN } });
    expect(err).toBeUndefined();
  });

  it('rejects with 403 FORBIDDEN_ROLE when the role is not allowed', async () => {
    const err = await run(authorize(ROLES.ADMIN), { user: { role: ROLES.MEMBER } });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN_ROLE');
  });

  it('rejects with 401 NO_AUTH when req.user is missing', async () => {
    const err = await run(authorize(ROLES.ADMIN), {});
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('NO_AUTH');
  });

  it('accepts any of several allowed roles', async () => {
    const mw = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);
    expect(await run(mw, { user: { role: ROLES.SUPER_ADMIN } })).toBeUndefined();
    const denied = await run(mw, { user: { role: ROLES.MANAGER } });
    expect(denied.statusCode).toBe(403);
  });

  it('throws at setup when called with no roles', () => {
    expect(() => authorize()).toThrow(/at least one role/);
  });

  it('throws at setup for an unknown role name', () => {
    expect(() => authorize('wizard')).toThrow(/unknown role/);
  });
});

describe('requireMinRole(role) — unit (hierarchical)', () => {
  it('allows the exact role', async () => {
    const err = await run(requireMinRole(ROLES.MANAGER), { user: { role: ROLES.MANAGER } });
    expect(err).toBeUndefined();
  });

  it('allows a higher-ranked role', async () => {
    const err = await run(requireMinRole(ROLES.MANAGER), { user: { role: ROLES.ADMIN } });
    expect(err).toBeUndefined();
  });

  it('rejects a lower-ranked role with 403', async () => {
    const err = await run(requireMinRole(ROLES.MANAGER), { user: { role: ROLES.MEMBER } });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN_ROLE');
  });

  it('rejects with 401 NO_AUTH when req.user is missing', async () => {
    const err = await run(requireMinRole(ROLES.MANAGER), {});
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('NO_AUTH');
  });

  it('throws at setup for an unknown role name', () => {
    expect(() => requireMinRole('wizard')).toThrow(/unknown role/);
  });
});

describe('RBAC — integration (authenticate + authorize + errorHandler)', () => {
  const app = express();
  app.use(express.json());
  app.get('/admin-only', authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), (req, res) =>
    res.json({ ok: true, role: req.user.role })
  );
  app.get('/manager-plus', authenticate, requireMinRole(ROLES.MANAGER), (_req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);

  async function tokenFor(role, email) {
    const user = await User.create({
      firstName: 'Role',
      lastName: 'Tester',
      email,
      password: 'Sup3rSecret',
      role,
    });
    return signAccessToken(user);
  }

  it('grants an admin access to an admin-only route', async () => {
    const token = await tokenFor(ROLES.ADMIN, 'admin@example.com');
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(ROLES.ADMIN);
  });

  it('forbids a member from an admin-only route (403 FORBIDDEN_ROLE)', async () => {
    const token = await tokenFor(ROLES.MEMBER, 'member@example.com');
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('rejects an unauthenticated request before RBAC runs (401 NO_TOKEN)', async () => {
    const res = await request(app).get('/admin-only');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('lets a higher rank through a "minimum role" gate', async () => {
    const token = await tokenFor(ROLES.SUPER_ADMIN, 'super@example.com');
    const res = await request(app).get('/manager-plus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('blocks a lower rank at a "minimum role" gate (403)', async () => {
    const token = await tokenFor(ROLES.MEMBER, 'member2@example.com');
    const res = await request(app).get('/manager-plus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });
});
