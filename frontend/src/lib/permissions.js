/**
 * Permission constants (client mirror of the backend catalog) plus a tiny
 * membership helper.
 *
 * The backend remains the source of truth: it enforces every permission and
 * *surfaces* the current user's granted permissions on the auth endpoints
 * (`/auth/me`, login, register). The client only needs the capability strings
 * to check against that list — it does NOT re-implement the role→permission
 * policy. These constants must stay in sync with
 * `backend/src/config/permissions.js`.
 */
export const PERMISSIONS = Object.freeze({
  USER_READ: 'user:read',
  USER_UPDATE_ROLE: 'user:update_role',
  USER_UPDATE_STATUS: 'user:update_status',
  USER_DELETE: 'user:delete',
  // Organization management (Module 3)
  ORG_READ: 'org:read',
  ORG_UPDATE: 'org:update',
  ORG_MANAGE_MEMBERS: 'org:manage_members',
  // Customer management (Module 4)
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',
  // Product & service catalog (Module 5)
  PRODUCT_READ: 'product:read',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',
  // Document templates (Module 6)
  TEMPLATE_READ: 'template:read',
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_UPDATE: 'template:update',
  TEMPLATE_DELETE: 'template:delete',
  // Generated documents (Module 7)
  DOCUMENT_READ: 'document:read',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
  // PDF export (Module 8)
  DOCUMENT_EXPORT: 'document:export',
  // Email service (Module 9)
  DOCUMENT_SEND: 'document:send',
  EMAIL_READ: 'email:read',
  EMAIL_RETRY: 'email:retry',
  // Approval workflow (Module 11)
  APPROVAL_READ: 'approval:read',
  APPROVAL_REQUEST: 'approval:request',
  APPROVAL_DECIDE: 'approval:decide',
  APPROVAL_CANCEL: 'approval:cancel',
  // Version history (Module 12)
  VERSION_READ: 'version:read',
  VERSION_RESTORE: 'version:restore',
  // Notifications (Module 13)
  NOTIFICATION_READ: 'notification:read',
  // Audit logs (Module 14)
  AUDIT_READ: 'audit:read',
  // Dashboard & analytics (Module 15)
  ANALYTICS_READ: 'analytics:read',
});

/**
 * Whether a granted-permissions list includes a given capability.
 * @param {string[] | null | undefined} granted
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(granted, permission) {
  return Array.isArray(granted) && granted.includes(permission);
}
