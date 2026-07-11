/**
 * Document version model (Module 12 — Version History).
 *
 * A version is an immutable snapshot of a document's content-defining state,
 * appended to the document's history each time it materially changes (generation,
 * regeneration, a manual content edit, or a restore). Versions are numbered
 * sequentially per document (`version` starts at 1) and are never mutated after
 * creation — restoring an old version copies its state back onto the live document
 * and appends a *new* version, so the history stays append-only.
 *
 * Versions are strictly tenant-scoped — each belongs to exactly one
 * `organization`, and all queries are confined to the caller's org (see
 * version.service.js).
 */
import mongoose from 'mongoose';
import {
  VERSION_CHANGE_TYPE,
  VERSION_CHANGE_TYPE_VALUES,
} from '../../config/constants.js';

const { Schema } = mongoose;

const documentVersionSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    document: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document is required'],
      index: true,
    },
    // Sequential version number within the document (1-based).
    version: {
      type: Number,
      required: [true, 'Version number is required'],
      min: 1,
    },
    changeType: {
      type: String,
      enum: VERSION_CHANGE_TYPE_VALUES,
      default: VERSION_CHANGE_TYPE.GENERATED,
      index: true,
    },
    // Snapshot of the document's content-defining fields at capture time. Stored
    // loosely (plain strings / Mixed) because these are a historical record, not a
    // live document — no need to re-validate against the current enums.
    title: { type: String, default: '' },
    type: { type: String, default: null },
    status: { type: String, default: null },
    content: { type: String, default: '' },
    values: { type: Schema.Types.Mixed, default: {} },
    templateSnapshot: { type: Schema.Types.Mixed, default: null },
    missingRequired: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    // Who caused this version (the acting user), if known.
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

// Common access pattern: list a document's history, newest version first.
documentVersionSchema.index({ document: 1, version: -1 });
// One row per (document, version) — guards against a duplicate version number.
documentVersionSchema.index(
  { document: 1, version: 1 },
  { unique: true, name: 'document_version_unique' }
);
// Org-wide activity feed (used by later modules), newest first.
documentVersionSchema.index({ organization: 1, createdAt: -1 });

const DocumentVersion = mongoose.model('DocumentVersion', documentVersionSchema);

export default DocumentVersion;
