/**
 * Application-wide constants and enumerations.
 * Centralizing these avoids magic strings scattered across features.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/**
 * Role hierarchy weights. Higher number = more privilege.
 * Used by RBAC middleware (Task 5) for "at least this role" checks.
 */
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

export const USER_STATUS_VALUES = Object.freeze(Object.values(USER_STATUS));

/**
 * Organization lifecycle status (Module 3). A suspended organization is a
 * tenant-level block; individual user suspension remains separate (USER_STATUS).
 */
export const ORG_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
});

export const ORG_STATUS_VALUES = Object.freeze(Object.values(ORG_STATUS));

/**
 * Customer classification (Module 4). A `business` is a company/organization you
 * do business with; an `individual` is a single person.
 */
export const CUSTOMER_TYPE = Object.freeze({
  BUSINESS: 'business',
  INDIVIDUAL: 'individual',
});

export const CUSTOMER_TYPE_VALUES = Object.freeze(Object.values(CUSTOMER_TYPE));

/**
 * Customer lifecycle status (Module 4). `archived` hides a customer from the
 * default working set without deleting its history.
 */
export const CUSTOMER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
});

export const CUSTOMER_STATUS_VALUES = Object.freeze(Object.values(CUSTOMER_STATUS));

/** Address classification on a customer (Module 4). */
export const ADDRESS_TYPE = Object.freeze({
  BILLING: 'billing',
  SHIPPING: 'shipping',
  OTHER: 'other',
});

export const ADDRESS_TYPE_VALUES = Object.freeze(Object.values(ADDRESS_TYPE));

export const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
});

export const BCRYPT_SALT_ROUNDS = 12;

/** How long a member invitation link stays valid (minutes). Default: 7 days. */
export const INVITE_TOKEN_EXPIRES_MIN = 7 * 24 * 60;

export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
});
