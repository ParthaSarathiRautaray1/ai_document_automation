/**
 * Role hierarchy — client mirror of `backend/src/config/constants.js`.
 *
 * Used only to shape permission-aware UI (which rows are actionable, which
 * roles appear in the assign dropdown). The backend re-enforces every rule
 * (self-protection, target strictly below actor, no escalation), so a stale
 * mirror can only ever *over*-restrict the UI, never grant real privilege.
 */
export const ROLES = Object.freeze({
  MEMBER: 'member',
  MANAGER: 'manager',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ROLE_RANK = Object.freeze({
  [ROLES.MEMBER]: 1,
  [ROLES.MANAGER]: 2,
  [ROLES.ADMIN]: 3,
  [ROLES.SUPER_ADMIN]: 4,
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INVITED: 'invited',
  SUSPENDED: 'suspended',
});

/** Human-readable role label ("super_admin" → "Super admin"). */
export function roleLabel(role) {
  if (!role) return '';
  const spaced = role.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function rankOf(role) {
  return ROLE_RANK[role] ?? 0;
}

/**
 * Whether `actor` may act on `target` (mutate role/status). Mirrors the backend
 * guards: not yourself, and target ranks strictly below you.
 */
export function canManageTarget(actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  return rankOf(target.role) < rankOf(actor.role);
}

/** Roles an actor may assign: strictly below their own rank. */
export function assignableRoles(actor) {
  const max = rankOf(actor?.role);
  return ROLE_VALUES.filter((role) => rankOf(role) < max);
}
