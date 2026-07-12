/**
 * Organization model (Module 3).
 *
 * An Organization is the top-level tenant in DocFlow AI. Every user belongs to
 * at most one organization (see `User.organization`), and business data
 * (customers, products, templates, documents…) will be scoped to it in later
 * modules. The user who creates the org at registration becomes its `owner`.
 *
 * Notes:
 *  - `slug` is a URL-safe, unique handle derived from the name. A base slug is
 *    generated here on validate; collision-free uniqueness (suffixing) is the
 *    service's responsibility (see organization.service.js), backed by the
 *    unique index as a last line of defense.
 *  - `owner` references the User who owns the tenant. Ownership transfer and
 *    org-scoped roles are handled by the membership flows, not this schema.
 */
import mongoose from 'mongoose';
import {
  ORG_STATUS,
  ORG_STATUS_VALUES,
  DOCUMENT_TYPE,
  DOCUMENT_TYPE_VALUES,
  DATE_FORMAT_VALUES,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIMEZONE,
  DEFAULT_CURRENCY,
} from '../../config/constants.js';

const { Schema } = mongoose;

/** Convert a display name into a URL-safe base slug. */
export function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/['’]/g, '') // drop apostrophes (so "Ada's" → "adas", not "ada-s")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // remaining non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 60);
}

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organization owner is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ORG_STATUS_VALUES,
      default: ORG_STATUS.ACTIVE,
      index: true,
    },
    billingEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid billing email address'],
    },
    settings: {
      // Org-wide preferences / defaults (Module 17 — Settings). `timezone` landed
      // in Module 3; the remaining keys were added here. Additive with defaults,
      // so organizations created before this module read back sensible values.
      timezone: { type: String, trim: true, default: DEFAULT_TIMEZONE },
      dateFormat: { type: String, enum: DATE_FORMAT_VALUES, default: DEFAULT_DATE_FORMAT },
      // Seeds new catalog items / documents (3-letter ISO 4217 code).
      defaultCurrency: {
        type: String,
        trim: true,
        uppercase: true,
        minlength: 3,
        maxlength: 3,
        default: DEFAULT_CURRENCY,
      },
      // Default type pre-selected when generating a document.
      defaultDocumentType: {
        type: String,
        enum: DOCUMENT_TYPE_VALUES,
        default: DOCUMENT_TYPE.OTHER,
      },
      branding: {
        primaryColor: { type: String, trim: true, default: '#4F46E5' },
        accentColor: { type: String, trim: true, default: '#0EA5E9' },
      },
      notifications: {
        // Org default for whether approval events also send email.
        approvalEmails: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/**
 * Generate a base slug from the name when none is set (e.g. on create, or after
 * a name change that clears the slug). If slugify yields an empty string (name
 * had no alphanumerics), fall back to a random handle so `required` still holds.
 */
organizationSchema.pre('validate', function ensureSlug(next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name) || `org-${Date.now().toString(36)}`;
  }
  next();
});

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;
