/**
 * Permission policy & authorizePermission middleware (Module 2 · Task 1).
 *
 * Layers:
 *  - Policy unit: role → permission mapping and helper correctness.
 *  - Middleware unit: allow / 403 FORBIDDEN_PERMISSION / 401 NO_AUTH + config guards.
 *  - Integration: real authenticate + authorizePermission + errorHandler on an
 *    inline app, exercising a permission-gated route across roles.
 */
import express from 'express';
import request from 'supertest';
import authenticate from '../src/middlewares/authenticate.js';
import { authorizePermission } from '../src/middlewares/authorize.js';
import errorHandler from '../src/middlewares/errorHandler.js';
import ApiError from '../src/utils/ApiError.js';
import User from '../src/features/users/user.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES } from '../src/config/constants.js';
import {
  PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
} from '../src/config/permissions.js';

function run(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err));
  });
}

describe('permission policy', () => {
  it('grants members read of their own organization + customers + catalog', () => {
    // No user-administration permissions; can view their own org (Module 3),
    // browse customers (Module 4), and browse the catalog (Module 5).
    expect(permissionsForRole(ROLES.MEMBER)).toEqual([
      PERMISSIONS.ORG_READ,
      PERMISSIONS.CUSTOMER_READ,
      PERMISSIONS.PRODUCT_READ,
    ]);
    expect(roleHasPermission(ROLES.MEMBER, PERMISSIONS.USER_READ)).toBe(false);
    expect(roleHasPermission(ROLES.MEMBER, PERMISSIONS.CUSTOMER_CREATE)).toBe(false);
    expect(roleHasPermission(ROLES.MEMBER, PERMISSIONS.PRODUCT_CREATE)).toBe(false);
  });

  it('grants managers user read + org read + customer/catalog create/update', () => {
    expect(permissionsForRole(ROLES.MANAGER)).toEqual([
      PERMISSIONS.USER_READ,
      PERMISSIONS.ORG_READ,
      PERMISSIONS.CUSTOMER_READ,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.PRODUCT_READ,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
    ]);
    expect(roleHasPermission(ROLES.MANAGER, PERMISSIONS.USER_UPDATE_ROLE)).toBe(false);
    expect(roleHasPermission(ROLES.MANAGER, PERMISSIONS.ORG_UPDATE)).toBe(false);
    expect(roleHasPermission(ROLES.MANAGER, PERMISSIONS.CUSTOMER_DELETE)).toBe(false);
    expect(roleHasPermission(ROLES.MANAGER, PERMISSIONS.PRODUCT_DELETE)).toBe(false);
  });

  it('grants admins user + org + customer + catalog management, but not user delete', () => {
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.USER_UPDATE_ROLE)).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.USER_UPDATE_STATUS)).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.ORG_UPDATE)).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.ORG_MANAGE_MEMBERS)).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.CUSTOMER_DELETE)).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.PRODUCT_DELETE)).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.USER_DELETE)).toBe(false);
  });

  it('grants super_admin every permission', () => {
    expect(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.USER_DELETE)).toBe(true);
    expect(permissionsForRole(ROLES.SUPER_ADMIN)).toEqual(Object.values(PERMISSIONS));
  });

  it('returns no permissions for an unknown role', () => {
    expect(permissionsForRole('wizard')).toEqual([]);
    expect(roleHasPermission('wizard', PERMISSIONS.USER_READ)).toBe(false);
  });
});

describe('authorizePermission — unit', () => {
  it('calls next() when the role has the permission', async () => {
    const err = await run(authorizePermission(PERMISSIONS.USER_READ), {
      user: { role: ROLES.MANAGER },
    });
    expect(err).toBeUndefined();
  });

  it('requires ALL listed permissions', async () => {
    // manager has USER_READ but not USER_DELETE → denied
    const err = await run(authorizePermission(PERMISSIONS.USER_READ, PERMISSIONS.USER_DELETE), {
      user: { role: ROLES.MANAGER },
    });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('rejects a role without the permission (403 FORBIDDEN_PERMISSION)', async () => {
    const err = await run(authorizePermission(PERMISSIONS.USER_READ), {
      user: { role: ROLES.MEMBER },
    });
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('rejects with 401 NO_AUTH when req.user is missing', async () => {
    const err = await run(authorizePermission(PERMISSIONS.USER_READ), {});
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('NO_AUTH');
  });

  it('throws at setup with no permissions', () => {
    expect(() => authorizePermission()).toThrow(/at least one permission/);
  });

  it('throws at setup for an unknown permission', () => {
    expect(() => authorizePermission('user:teleport')).toThrow(/unknown permission/);
  });
});

describe('authorizePermission — integration', () => {
  const app = express();
  app.use(express.json());
  app.get('/users', authenticate, authorizePermission(PERMISSIONS.USER_READ), (_req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);

  async function tokenFor(role, email) {
    const user = await User.create({
      firstName: 'Perm',
      lastName: 'Tester',
      email,
      password: 'Sup3rSecret',
      role,
    });
    return signAccessToken(user);
  }

  it('allows a manager (has user:read) to a read-gated route', async () => {
    const token = await tokenFor(ROLES.MANAGER, 'manager@example.com');
    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('forbids a member (no user:read) with 403 FORBIDDEN_PERMISSION', async () => {
    const token = await tokenFor(ROLES.MEMBER, 'member@example.com');
    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('rejects an unauthenticated request (401 NO_TOKEN) before the permission check', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });
});
