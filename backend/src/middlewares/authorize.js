/**
 * Role-Based Access Control (RBAC) middleware.
 *
 * These run AFTER `authenticate` (which attaches `req.user`). Two styles are
 * provided:
 *
 *  - `authorize(...roles)`   — allow only the listed roles (exact match). Use
 *                              for "these specific roles and no others".
 *  - `requireMinRole(role)`  — hierarchical: allow the given role or any higher
 *                              rank (see ROLE_RANK). Use for "at least X".
 *  - `authorizePermission(...perms)` — allow only roles granted ALL the listed
 *                              permissions (see config/permissions.js). Prefer
 *                              this for feature routes so capabilities can be
 *                              re-assigned without editing routes.
 *
 * Role checks reject with `403 FORBIDDEN_ROLE`; permission checks with
 * `403 FORBIDDEN_PERMISSION`. A missing `req.user` (middleware wired without
 * `authenticate` in front) yields `401 NO_AUTH`. Misconfiguration with unknown
 * role/permission names throws at startup — a programmer error, surfaced early.
 */
import ApiError from '../utils/ApiError.js';
import { ROLE_RANK, ROLE_VALUES } from '../config/constants.js';
import { PERMISSION_VALUES, roleHasPermission } from '../config/permissions.js';

const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action';

function assertKnownRoles(roles) {
  const unknown = roles.filter((r) => !ROLE_VALUES.includes(r));
  if (unknown.length > 0) {
    throw new Error(`authorize(): unknown role(s): ${unknown.join(', ')}`);
  }
}

/**
 * Allow only the exact roles listed.
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
export function authorize(...allowedRoles) {
  if (allowedRoles.length === 0) {
    throw new Error('authorize(): at least one role is required');
  }
  assertKnownRoles(allowedRoles);
  const allowed = new Set(allowedRoles);

  return function authorizeMiddleware(req, _res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', { code: 'NO_AUTH' }));
    }
    if (!allowed.has(req.user.role)) {
      return next(ApiError.forbidden(FORBIDDEN_MESSAGE, { code: 'FORBIDDEN_ROLE' }));
    }
    return next();
  };
}

/**
 * Allow the given role or any higher-ranked role (hierarchical).
 * @param {string} minRole
 * @returns {import('express').RequestHandler}
 */
export function requireMinRole(minRole) {
  const threshold = ROLE_RANK[minRole];
  if (threshold === undefined) {
    throw new Error(`requireMinRole(): unknown role "${minRole}"`);
  }

  return function requireMinRoleMiddleware(req, _res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', { code: 'NO_AUTH' }));
    }
    const rank = ROLE_RANK[req.user.role] ?? 0;
    if (rank < threshold) {
      return next(ApiError.forbidden(FORBIDDEN_MESSAGE, { code: 'FORBIDDEN_ROLE' }));
    }
    return next();
  };
}

/**
 * Allow only roles granted ALL of the listed permissions.
 * @param {...string} requiredPermissions
 * @returns {import('express').RequestHandler}
 */
export function authorizePermission(...requiredPermissions) {
  if (requiredPermissions.length === 0) {
    throw new Error('authorizePermission(): at least one permission is required');
  }
  const unknown = requiredPermissions.filter((p) => !PERMISSION_VALUES.includes(p));
  if (unknown.length > 0) {
    throw new Error(`authorizePermission(): unknown permission(s): ${unknown.join(', ')}`);
  }

  return function authorizePermissionMiddleware(req, _res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', { code: 'NO_AUTH' }));
    }
    const allowed = requiredPermissions.every((p) => roleHasPermission(req.user.role, p));
    if (!allowed) {
      return next(ApiError.forbidden(FORBIDDEN_MESSAGE, { code: 'FORBIDDEN_PERMISSION' }));
    }
    return next();
  };
}
