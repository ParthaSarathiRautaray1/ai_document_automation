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

  // Organization management (Module 3)
  ORG_READ: 'org:read', // view own organization profile
  ORG_UPDATE: 'org:update', // edit organization profile/settings
  ORG_MANAGE_MEMBERS: 'org:manage_members', // invite / remove / re-role members

  // Customer management (Module 4)
  CUSTOMER_READ: 'customer:read', // view customers (list + detail)
  CUSTOMER_CREATE: 'customer:create', // add a customer
  CUSTOMER_UPDATE: 'customer:update', // edit a customer + its contacts/addresses
  CUSTOMER_DELETE: 'customer:delete', // remove a customer

  // Product & service catalog (Module 5)
  PRODUCT_READ: 'product:read', // view catalog items (list + detail)
  PRODUCT_CREATE: 'product:create', // add a catalog item
  PRODUCT_UPDATE: 'product:update', // edit a catalog item
  PRODUCT_DELETE: 'product:delete', // remove a catalog item
});

export const PERMISSION_VALUES = Object.freeze(Object.values(PERMISSIONS));

const {
  USER_READ,
  USER_UPDATE_ROLE,
  USER_UPDATE_STATUS,
  USER_DELETE,
  ORG_READ,
  ORG_UPDATE,
  ORG_MANAGE_MEMBERS,
  CUSTOMER_READ,
  CUSTOMER_CREATE,
  CUSTOMER_UPDATE,
  CUSTOMER_DELETE,
  PRODUCT_READ,
  PRODUCT_CREATE,
  PRODUCT_UPDATE,
  PRODUCT_DELETE,
} = PERMISSIONS;

/**
 * Role → granted permissions. Higher roles are supersets today, but each is
 * listed explicitly (not derived) so the policy stays readable and can diverge
 * later without a rewrite.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  // Every org member can read their own org and browse the customer + catalog lists.
  [ROLES.MEMBER]: Object.freeze([ORG_READ, CUSTOMER_READ, PRODUCT_READ]),
  // Managers additionally read users and create/update customers + catalog (no delete).
  [ROLES.MANAGER]: Object.freeze([
    USER_READ,
    ORG_READ,
    CUSTOMER_READ,
    CUSTOMER_CREATE,
    CUSTOMER_UPDATE,
    PRODUCT_READ,
    PRODUCT_CREATE,
    PRODUCT_UPDATE,
  ]),
  [ROLES.ADMIN]: Object.freeze([
    USER_READ,
    USER_UPDATE_ROLE,
    USER_UPDATE_STATUS,
    ORG_READ,
    ORG_UPDATE,
    ORG_MANAGE_MEMBERS,
    CUSTOMER_READ,
    CUSTOMER_CREATE,
    CUSTOMER_UPDATE,
    CUSTOMER_DELETE,
    PRODUCT_READ,
    PRODUCT_CREATE,
    PRODUCT_UPDATE,
    PRODUCT_DELETE,
  ]),
  [ROLES.SUPER_ADMIN]: Object.freeze([
    USER_READ,
    USER_UPDATE_ROLE,
    USER_UPDATE_STATUS,
    USER_DELETE,
    ORG_READ,
    ORG_UPDATE,
    ORG_MANAGE_MEMBERS,
    CUSTOMER_READ,
    CUSTOMER_CREATE,
    CUSTOMER_UPDATE,
    CUSTOMER_DELETE,
    PRODUCT_READ,
    PRODUCT_CREATE,
    PRODUCT_UPDATE,
    PRODUCT_DELETE,
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
