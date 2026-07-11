/**
 * Document model (Module 7 — Document Generation).
 *
 * A document is a concrete, persisted instance produced by rendering a template:
 * its `content` is the template body with `{{placeholders}}` substituted from the
 * supplied `values`. To stay stable even if the source template is later edited
 * or deleted, each document captures a `templateSnapshot` (the body + declared
 * variables) at generation time — regeneration always renders from that snapshot.
 *
 * Documents are strictly tenant-scoped — every document belongs to exactly one
 * `organization`, and all queries are confined to the caller's org (see
 * document.service.js).
 */
import mongoose from 'mongoose';
import {
  DOCUMENT_TYPE,
  DOCUMENT_TYPE_VALUES,
  DOCUMENT_STATUS,
  DOCUMENT_STATUS_VALUES,
} from '../../config/constants.js';

const { Schema } = mongoose;

/**
 * Immutable copy of the source template at generation time. Keeps a document
 * reproducible even after the template changes or is deleted. `variables` mirrors
 * the template's declared variables (stored loosely as the engine only reads
 * `key`, `required`, and `defaultValue`).
 */
const templateSnapshotSchema = new Schema(
  {
    name: { type: String, default: null },
    type: { type: String, default: null },
    content: { type: String, default: '' },
    variables: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const documentSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: DOCUMENT_TYPE_VALUES,
      default: DOCUMENT_TYPE.OTHER,
      index: true,
    },
    status: {
      type: String,
      enum: DOCUMENT_STATUS_VALUES,
      default: DOCUMENT_STATUS.DRAFT,
      index: true,
    },
    // Source template (may become null if the template is later deleted).
    template: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
      default: null,
      index: true,
    },
    templateSnapshot: { type: templateSnapshotSchema, default: () => ({}) },
    // Optional link to a customer this document is for.
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    // Values supplied at generation, keyed by variable key. Stored loosely so
    // numbers/booleans/strings round-trip; rendered as text by the engine.
    values: { type: Schema.Types.Mixed, default: {} },
    // Rendered output (template body with placeholders substituted).
    content: {
      type: String,
      required: [true, 'Document content is required'],
      maxlength: 200000,
    },
    // Required variables that had neither a supplied value nor a default at the
    // last (re)generation — informational, surfaced to the UI.
    missingRequired: { type: [String], default: [] },
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

// Common access pattern: list/search within one org, newest first.
documentSchema.index({ organization: 1, createdAt: -1 });

const Document = mongoose.model('Document', documentSchema);

export default Document;
