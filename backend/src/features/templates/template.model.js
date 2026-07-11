/**
 * Template model (Module 6 — Template Engine).
 *
 * A template is a reusable document blueprint an organization authors once and
 * generates many documents from. Its `content` is body text containing
 * `{{variable}}` placeholders; the declared `variables` describe those
 * placeholders (label, type, whether required, an optional default).
 *
 * Templates are strictly tenant-scoped — every template belongs to exactly one
 * `organization`, and all queries are confined to the caller's org (see
 * template.service.js). Rendering (substituting values into `content`) is a pure
 * operation implemented in template.engine.js.
 */
import mongoose from 'mongoose';
import {
  TEMPLATE_TYPE,
  TEMPLATE_TYPE_VALUES,
  TEMPLATE_STATUS,
  TEMPLATE_STATUS_VALUES,
  TEMPLATE_VARIABLE_TYPE,
  TEMPLATE_VARIABLE_TYPE_VALUES,
} from '../../config/constants.js';

const { Schema } = mongoose;

/**
 * A single declared variable (placeholder) on a template. Kept as an embedded
 * subdocument (own `_id`) so the UI can address individual rows.
 */
const templateVariableSchema = new Schema(
  {
    // Placeholder identifier used in content as `{{key}}`. Letters, digits, and
    // underscores; must start with a letter. Uniqueness within a template is
    // enforced by the pre-validate hook below.
    key: {
      type: String,
      required: [true, 'Variable key is required'],
      trim: true,
      maxlength: 60,
      match: [/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid variable key'],
    },
    label: { type: String, trim: true, maxlength: 120, default: null },
    type: {
      type: String,
      enum: TEMPLATE_VARIABLE_TYPE_VALUES,
      default: TEMPLATE_VARIABLE_TYPE.TEXT,
    },
    required: { type: Boolean, default: false },
    // Value substituted when no value is supplied at render time. Stored as a
    // string (values are rendered as text); null means "no default".
    defaultValue: { type: String, maxlength: 1000, default: null },
    description: { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: true }
);

const templateSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: 200,
    },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    type: {
      type: String,
      enum: TEMPLATE_TYPE_VALUES,
      default: TEMPLATE_TYPE.OTHER,
      index: true,
    },
    status: {
      type: String,
      enum: TEMPLATE_STATUS_VALUES,
      default: TEMPLATE_STATUS.DRAFT,
      index: true,
    },
    // Body text with `{{variable}}` placeholders.
    content: {
      type: String,
      required: [true, 'Template content is required'],
      maxlength: 50000,
    },
    variables: { type: [templateVariableSchema], default: [] },
    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
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

// Common access pattern: list/search within one org.
templateSchema.index({ organization: 1, createdAt: -1 });

// Variable keys must be unique within a single template.
templateSchema.pre('validate', function enforceUniqueVariableKeys(next) {
  if (Array.isArray(this.variables)) {
    const seen = new Set();
    for (const variable of this.variables) {
      if (seen.has(variable.key)) {
        this.invalidate('variables', `Duplicate variable key "${variable.key}"`);
        break;
      }
      seen.add(variable.key);
    }
  }
  next();
});

const Template = mongoose.model('Template', templateSchema);

export default Template;
