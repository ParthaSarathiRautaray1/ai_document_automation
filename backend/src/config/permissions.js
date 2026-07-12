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

  // Document templates (Module 6)
  TEMPLATE_READ: 'template:read', // view templates (list + detail) + render preview
  TEMPLATE_CREATE: 'template:create', // add a template
  TEMPLATE_UPDATE: 'template:update', // edit a template + its variables
  TEMPLATE_DELETE: 'template:delete', // remove a template

  // Generated documents (Module 7)
  DOCUMENT_READ: 'document:read', // view documents (list + detail)
  DOCUMENT_CREATE: 'document:create', // generate a document from a template
  DOCUMENT_UPDATE: 'document:update', // edit / regenerate a document
  DOCUMENT_DELETE: 'document:delete', // remove a document

  // PDF export (Module 8) — render a document to a downloadable PDF
  DOCUMENT_EXPORT: 'document:export', // export a document as PDF

  // Email service (Module 9)
  DOCUMENT_SEND: 'document:send', // deliver a document to a recipient by email
  EMAIL_READ: 'email:read', // view the organization's email log
  EMAIL_RETRY: 'email:retry', // re-attempt a failed/queued email

  // Approval workflow (Module 11)
  APPROVAL_READ: 'approval:read', // view approval requests (list + detail)
  APPROVAL_REQUEST: 'approval:request', // route a document for approval
  APPROVAL_DECIDE: 'approval:decide', // approve/reject a request you are an approver on
  APPROVAL_CANCEL: 'approval:cancel', // withdraw a pending approval request

  // Version history (Module 12)
  VERSION_READ: 'version:read', // view a document's version history + diffs
  VERSION_RESTORE: 'version:restore', // roll a document back to a previous version

  // Notifications (Module 13) — every operation is on the caller's OWN
  // notifications, so a single self-scoped capability covers read + manage.
  NOTIFICATION_READ: 'notification:read', // view + manage your own notifications
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
  TEMPLATE_READ,
  TEMPLATE_CREATE,
  TEMPLATE_UPDATE,
  TEMPLATE_DELETE,
  DOCUMENT_READ,
  DOCUMENT_CREATE,
  DOCUMENT_UPDATE,
  DOCUMENT_DELETE,
  DOCUMENT_EXPORT,
  DOCUMENT_SEND,
  EMAIL_READ,
  EMAIL_RETRY,
  APPROVAL_READ,
  APPROVAL_REQUEST,
  APPROVAL_DECIDE,
  APPROVAL_CANCEL,
  VERSION_READ,
  VERSION_RESTORE,
  NOTIFICATION_READ,
} = PERMISSIONS;

/**
 * Role → granted permissions. Higher roles are supersets today, but each is
 * listed explicitly (not derived) so the policy stays readable and can diverge
 * later without a rewrite.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  // Every org member can read their own org and browse the customer, catalog,
  // and template lists.
  [ROLES.MEMBER]: Object.freeze([
    ORG_READ,
    CUSTOMER_READ,
    PRODUCT_READ,
    TEMPLATE_READ,
    DOCUMENT_READ,
    DOCUMENT_EXPORT,
    APPROVAL_READ,
    VERSION_READ,
    NOTIFICATION_READ,
  ]),
  // Managers additionally read users and create/update customers, catalog,
  // templates, and documents (no delete).
  [ROLES.MANAGER]: Object.freeze([
    USER_READ,
    ORG_READ,
    CUSTOMER_READ,
    CUSTOMER_CREATE,
    CUSTOMER_UPDATE,
    PRODUCT_READ,
    PRODUCT_CREATE,
    PRODUCT_UPDATE,
    TEMPLATE_READ,
    TEMPLATE_CREATE,
    TEMPLATE_UPDATE,
    DOCUMENT_READ,
    DOCUMENT_CREATE,
    DOCUMENT_UPDATE,
    DOCUMENT_EXPORT,
    DOCUMENT_SEND,
    EMAIL_READ,
    EMAIL_RETRY,
    APPROVAL_READ,
    APPROVAL_REQUEST,
    APPROVAL_DECIDE,
    APPROVAL_CANCEL,
    VERSION_READ,
    VERSION_RESTORE,
    NOTIFICATION_READ,
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
    TEMPLATE_READ,
    TEMPLATE_CREATE,
    TEMPLATE_UPDATE,
    TEMPLATE_DELETE,
    DOCUMENT_READ,
    DOCUMENT_CREATE,
    DOCUMENT_UPDATE,
    DOCUMENT_DELETE,
    DOCUMENT_EXPORT,
    DOCUMENT_SEND,
    EMAIL_READ,
    EMAIL_RETRY,
    APPROVAL_READ,
    APPROVAL_REQUEST,
    APPROVAL_DECIDE,
    APPROVAL_CANCEL,
    VERSION_READ,
    VERSION_RESTORE,
    NOTIFICATION_READ,
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
    TEMPLATE_READ,
    TEMPLATE_CREATE,
    TEMPLATE_UPDATE,
    TEMPLATE_DELETE,
    DOCUMENT_READ,
    DOCUMENT_CREATE,
    DOCUMENT_UPDATE,
    DOCUMENT_DELETE,
    DOCUMENT_EXPORT,
    DOCUMENT_SEND,
    EMAIL_READ,
    EMAIL_RETRY,
    APPROVAL_READ,
    APPROVAL_REQUEST,
    APPROVAL_DECIDE,
    APPROVAL_CANCEL,
    VERSION_READ,
    VERSION_RESTORE,
    NOTIFICATION_READ,
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
