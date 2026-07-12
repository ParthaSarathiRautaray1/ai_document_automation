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
  NOTIFICATION: 'notification',
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

/**
 * How a document version came to exist (Module 12 — Version History). Each time a
 * document materially changes, an immutable snapshot is appended to its history:
 * `generated` when first created from a template, `regenerated` when re-rendered
 * from its snapshot, `edited` when its content was changed by hand, and `restored`
 * when a previous version was rolled back onto the live document.
 */
export const VERSION_CHANGE_TYPE = Object.freeze({
  GENERATED: 'generated',
  REGENERATED: 'regenerated',
  EDITED: 'edited',
  RESTORED: 'restored',
});

export const VERSION_CHANGE_TYPE_VALUES = Object.freeze(Object.values(VERSION_CHANGE_TYPE));

/**
 * In-app notification classification (Module 13 — Notifications). Records what
 * event a notification represents. Notifications are per-user and org-scoped;
 * some events also trigger a transactional email (see notification.service.js).
 * `system` is a generic catch-all for messages that don't fit a specific event.
 */
export const NOTIFICATION_TYPE = Object.freeze({
  APPROVAL_REQUESTED: 'approval_requested', // you were asked to approve a document
  APPROVAL_APPROVED: 'approval_approved', // a request you raised was approved
  APPROVAL_REJECTED: 'approval_rejected', // a request you raised was rejected
  SYSTEM: 'system', // generic/system message
});

export const NOTIFICATION_TYPE_VALUES = Object.freeze(Object.values(NOTIFICATION_TYPE));

/**
 * The kind of entity an audit log entry refers to (Module 14 — Audit Logs). An
 * audit log records "who did what to which entity"; `entityType` classifies the
 * target so the trail can be filtered per resource kind.
 */
export const AUDIT_ENTITY_TYPE = Object.freeze({
  DOCUMENT: 'document',
  TEMPLATE: 'template',
  CUSTOMER: 'customer',
  PRODUCT: 'product',
  APPROVAL: 'approval',
  EMAIL: 'email',
  USER: 'user',
  ORGANIZATION: 'organization',
});

export const AUDIT_ENTITY_TYPE_VALUES = Object.freeze(Object.values(AUDIT_ENTITY_TYPE));

/**
 * Well-known audit action strings (Module 14). Actions follow a
 * `<entity>.<verb>` convention. The model stores `action` as a free-form string
 * (so future modules can record new actions without editing a central enum);
 * these constants name the ones emitted today and keep call sites typo-safe.
 */
export const AUDIT_ACTION = Object.freeze({
  DOCUMENT_GENERATE: 'document.generate',
  DOCUMENT_REGENERATE: 'document.regenerate',
  DOCUMENT_UPDATE: 'document.update',
  DOCUMENT_DELETE: 'document.delete',
  APPROVAL_REQUEST: 'approval.request',
  APPROVAL_DECIDE: 'approval.decide',
  APPROVAL_CANCEL: 'approval.cancel',
});

export const AUDIT_ACTION_VALUES = Object.freeze(Object.values(AUDIT_ACTION));

/**
 * Dashboard & Analytics (Module 15). The "recent activity" feed returns the most
 * recently created documents; these bound how many rows a caller may request.
 */
export const ANALYTICS_RECENT_DEFAULT_LIMIT = 5;
export const ANALYTICS_RECENT_MAX_LIMIT = 20;

/**
 * AI Assistant (Module 16 — OpenRouter). The assistant is strictly assistive: it
 * runs only on explicit user action, operates on a supplied snippet of text (it
 * never authors a whole document), and its results are cached. `AI_OPERATION`
 * enumerates the text operations it can perform.
 */
export const AI_OPERATION = Object.freeze({
  IMPROVE: 'improve', // improve clarity/professionalism of the text
  SUMMARIZE: 'summarize', // produce a concise summary
  SHORTEN: 'shorten', // make the text more concise
  EXPAND: 'expand', // elaborate/flesh out the text
  FIX_GRAMMAR: 'fix_grammar', // correct grammar & spelling only
  CHANGE_TONE: 'change_tone', // rewrite the text in a requested tone
});

export const AI_OPERATION_VALUES = Object.freeze(Object.values(AI_OPERATION));

/**
 * Target tones for the `change_tone` operation (Module 16). Supplied by the
 * caller when `operation === change_tone`.
 */
export const AI_TONE = Object.freeze({
  PROFESSIONAL: 'professional',
  FORMAL: 'formal',
  FRIENDLY: 'friendly',
  CASUAL: 'casual',
  PERSUASIVE: 'persuasive',
  CONCISE: 'concise',
});

export const AI_TONE_VALUES = Object.freeze(Object.values(AI_TONE));

/** Upper bound on the input text an AI operation will accept (characters). */
export const AI_MAX_INPUT_CHARS = 8000;

/** Cap on the tokens the model may generate per AI request (cost control). */
export const AI_MAX_OUTPUT_TOKENS = 1024;

/** Bounds for the AI completion history feed (recent suggestions). */
export const AI_HISTORY_DEFAULT_LIMIT = 10;
export const AI_HISTORY_MAX_LIMIT = 50;

/**
 * User & organization preferences (Module 17 — Settings). These enumerate the
 * presentation/localization choices a user picks for themselves (`preferences`
 * subdoc on User) or an admin sets as org-wide defaults (`settings` bag on
 * Organization). They are display hints — the API stores the chosen value and the
 * client uses it to format dates, pick a theme, seed generation defaults, etc.
 */
export const THEME = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system', // follow the OS/browser preference
});

export const THEME_VALUES = Object.freeze(Object.values(THEME));

/**
 * Date display formats offered in Settings (Module 17). The stored value is just
 * the chosen pattern string; the tokens are interpreted client-side.
 */
export const DATE_FORMAT = Object.freeze({
  ISO: 'YYYY-MM-DD',
  US: 'MM/DD/YYYY',
  EU: 'DD/MM/YYYY',
  LONG: 'MMM D, YYYY',
});

export const DATE_FORMAT_VALUES = Object.freeze(Object.values(DATE_FORMAT));

/** Default preference values (Module 17), applied as schema defaults. */
export const DEFAULT_THEME = THEME.SYSTEM;
export const DEFAULT_DATE_FORMAT = DATE_FORMAT.LONG;
export const DEFAULT_LOCALE = 'en';
export const DEFAULT_TIMEZONE = 'UTC';

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
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
});
