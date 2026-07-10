/**
 * Permission catalog & role → permission policy (Module 2).
 *
 * Permissions are fine-grained `domain:action` capability strings. Roles map to
 * a set of permissions (a static policy — see ADR-0015). Route handlers check a
 * *permission* rather than a role wherever practical, so the capability can be
 * re-assigned to a different role later without touching the routes.
 *
 * Naming convention: `<resource>:<action>` (e.g. `user:read`). New domains are
 * added here as their modules land; keep this file the single source of truth.
 *
 * NOTE: permission checks answer "may this role attempt the action?". Contextual
 * rules (e.g. no privilege escalation, can't suspend yourself) are enforced in
 * the service layer, not here.
 */
import { ROLES } from './constants.js';

export const PERMISSIONS = Object.freeze({
  // User administration (Module 2)
  USER_READ: 'user:read',
  USER_UPDATE_ROLE: 'user:update_role',
  USER_UPDATE_STATUS: 'user:update_status',
  USER_DELETE: 'user:delete',
});

export const PERMISSION_VALUES = Object.freeze(Object.values(PERMISSIONS));

const { USER_READ, USER_UPDATE_ROLE, USER_UPDATE_STATUS, USER_DELETE } = PERMISSIONS;

/**
 * Role → granted permissions. Higher roles are supersets today, but each is
 * listed explicitly (not derived) so the policy stays readable and can diverge
 * later without a rewrite.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.MEMBER]: Object.freeze([]),
  [ROLES.MANAGER]: Object.freeze([USER_READ]),
  [ROLES.ADMIN]: Object.freeze([USER_READ, USER_UPDATE_ROLE, USER_UPDATE_STATUS]),
  [ROLES.SUPER_ADMIN]: Object.freeze([
    USER_READ,
    USER_UPDATE_ROLE,
    USER_UPDATE_STATUS,
    USER_DELETE,
  ]),
});

/**
 * Permissions granted to a role (empty array for unknown roles).
 * @param {string} role
 * @returns {readonly string[]}
 */
export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Whether a role is granted a specific permission.
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function roleHasPermission(role, permission) {
  return permissionsForRole(role).includes(permission);
}
