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

/**
 * Catalog item classification (Module 5). A `product` is a physical/tangible
 * good you sell; a `service` is labour/time-based work.
 */
export const PRODUCT_TYPE = Object.freeze({
  PRODUCT: 'product',
  SERVICE: 'service',
});

export const PRODUCT_TYPE_VALUES = Object.freeze(Object.values(PRODUCT_TYPE));

/**
 * Catalog item lifecycle status (Module 5). `archived` hides an item from the
 * default working set (and from being sold) without deleting its history.
 */
export const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
});

export const PRODUCT_STATUS_VALUES = Object.freeze(Object.values(PRODUCT_STATUS));

/** Default pricing currency (ISO 4217) when a catalog item omits one. */
export const DEFAULT_CURRENCY = 'USD';

/**
 * Document template classification (Module 6 — Template Engine). A template is a
 * reusable document blueprint (body text with `{{variable}}` placeholders).
 */
export const TEMPLATE_TYPE = Object.freeze({
  INVOICE: 'invoice',
  QUOTE: 'quote',
  CONTRACT: 'contract',
  PROPOSAL: 'proposal',
  LETTER: 'letter',
  OTHER: 'other',
});

export const TEMPLATE_TYPE_VALUES = Object.freeze(Object.values(TEMPLATE_TYPE));

/**
 * Template lifecycle status (Module 6). `draft` while being authored, `active`
 * once ready to generate documents from, `archived` to retire without deleting.
 */
export const TEMPLATE_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const TEMPLATE_STATUS_VALUES = Object.freeze(Object.values(TEMPLATE_STATUS));

/**
 * The value type of a template variable (Module 6). Values are stored/rendered
 * as strings; the type is a hint for the UI and (later) document generation.
 */
export const TEMPLATE_VARIABLE_TYPE = Object.freeze({
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
});

export const TEMPLATE_VARIABLE_TYPE_VALUES = Object.freeze(
  Object.values(TEMPLATE_VARIABLE_TYPE)
);

/**
 * Generated document classification (Module 7 — Document Generation). A document
 * is a concrete instance produced by rendering a template's content with supplied
 * values. Its type mirrors the source template's type (invoice, quote, …).
 */
export const DOCUMENT_TYPE = Object.freeze({
  INVOICE: 'invoice',
  QUOTE: 'quote',
  CONTRACT: 'contract',
  PROPOSAL: 'proposal',
  LETTER: 'letter',
  OTHER: 'other',
});

export const DOCUMENT_TYPE_VALUES = Object.freeze(Object.values(DOCUMENT_TYPE));

/**
 * Document lifecycle status (Module 7). `draft` while still being edited/filled,
 * `final` once ready to send/export, `archived` to retire without deleting.
 */
export const DOCUMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  FINAL: 'final',
  ARCHIVED: 'archived',
});

export const DOCUMENT_STATUS_VALUES = Object.freeze(Object.values(DOCUMENT_STATUS));

/**
 * PDF export defaults (Module 8 — PDF Engine). A document is rendered to a
 * print-ready HTML page and converted to PDF by a headless browser.
 */
export const PDF_PAGE_FORMAT = 'A4';

/** Page margins for generated PDFs (CSS length units). */
export const PDF_MARGINS = Object.freeze({
  top: '18mm',
  right: '16mm',
  bottom: '18mm',
  left: '16mm',
});

/**
 * Transactional email classification (Module 9 — Email Service). Records what
 * kind of message an entry in the email log/queue represents.
 */
export const EMAIL_TYPE = Object.freeze({
  PASSWORD_RESET: 'password_reset',
  INVITATION: 'invitation',
  DOCUMENT_DELIVERY: 'document_delivery',
  OTHER: 'other',
});

export const EMAIL_TYPE_VALUES = Object.freeze(Object.values(EMAIL_TYPE));

/**
 * Lifecycle of a queued email (Module 9). `queued` awaits a send attempt;
 * `sending` is in flight; `sent` succeeded; `failed` exhausted its retries;
 * `skipped` means no email provider was configured (dev/CI) so nothing was sent.
 */
export const EMAIL_STATUS = Object.freeze({
  QUEUED: 'queued',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

export const EMAIL_STATUS_VALUES = Object.freeze(Object.values(EMAIL_STATUS));

/** How many times the queue will attempt to deliver a message before failing. */
export const EMAIL_MAX_ATTEMPTS = 3;

/**
 * Approval request lifecycle (Module 11 — Approval Workflow). A request routes a
 * document to one or more approvers. `pending` while awaiting decisions;
 * `approved`/`rejected` are terminal outcomes; `cancelled` when withdrawn by the
 * requester/admin before a decision was reached.
 */
export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

export const APPROVAL_STATUS_VALUES = Object.freeze(Object.values(APPROVAL_STATUS));

/**
 * How many approvers must approve for the request to be approved (Module 11).
 * `all` = every approver must approve; `any` = a single approval suffices. Under
 * either policy, one rejection rejects the whole request.
 */
export const APPROVAL_POLICY = Object.freeze({
  ALL: 'all',
  ANY: 'any',
});

export const APPROVAL_POLICY_VALUES = Object.freeze(Object.values(APPROVAL_POLICY));

/** Per-approver decision status within a request (Module 11). */
export const APPROVER_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const APPROVER_STATUS_VALUES = Object.freeze(Object.values(APPROVER_STATUS));

/** The decision an approver submits on their step (Module 11). */
export const APPROVAL_DECISION = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
});

export const APPROVAL_DECISION_VALUES = Object.freeze(Object.values(APPROVAL_DECISION));

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
