/**
 * AuditLog model (Module 14 — Audit Logs).
 *
 * An append-only, immutable record of "who did what to which entity" within an
 * organization. Each entry captures the acting user (with a denormalized name +
 * email snapshot, so the trail stays readable even if that user is later renamed
 * or removed), the `action` performed (a `<entity>.<verb>` string), the target
 * entity (`entityType` + `entityId` + a denormalized `entityLabel` for display),
 * and optional contextual `metadata`.
 *
 * Audit logs are tenant-scoped (`organization`) and never mutated after creation
 * — the service exposes only create (internal, best-effort) and read paths.
 */
import mongoose from 'mongoose';
import { AUDIT_ENTITY_TYPE_VALUES } from '../../config/constants.js';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    // The user who performed the action (nullable for system/automated actions).
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Denormalized snapshot of the actor for display, captured at write time.
    actorName: { type: String, trim: true, maxlength: 200, default: null },
    actorEmail: { type: String, trim: true, maxlength: 320, default: null },
    // A `<entity>.<verb>` action string (e.g. `document.generate`).
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      maxlength: 100,
      index: true,
    },
    // What kind of entity the action targeted.
    entityType: {
      type: String,
      enum: AUDIT_ENTITY_TYPE_VALUES,
      required: [true, 'Entity type is required'],
      index: true,
    },
    // The id of the targeted entity (nullable — some actions have no single id).
    entityId: { type: Schema.Types.ObjectId, default: null },
    // Denormalized label (e.g. a document title) for display without a join.
    entityLabel: { type: String, trim: true, maxlength: 300, default: null },
    // Arbitrary contextual payload (e.g. { decision, status }).
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
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

// Common access pattern: an org's activity trail, newest first.
auditLogSchema.index({ organization: 1, createdAt: -1 });
// A single entity's history (e.g. everything that happened to one document).
auditLogSchema.index({ organization: 1, entityType: 1, entityId: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
