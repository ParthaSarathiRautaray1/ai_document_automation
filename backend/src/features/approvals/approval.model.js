/**
 * Approval request model (Module 11 — Approval Workflow).
 *
 * An approval request routes one document to one or more approvers. Each approver
 * has an embedded decision "step" (pending → approved/rejected). The request's own
 * `status` is derived from those steps under a `policy` (`all` = everyone must
 * approve; `any` = a single approval suffices); one rejection rejects the whole
 * request. Requests are strictly tenant-scoped — each belongs to exactly one
 * `organization`, and all queries are confined to the caller's org (see
 * approval.service.js).
 */
import mongoose from 'mongoose';
import {
  APPROVAL_STATUS,
  APPROVAL_STATUS_VALUES,
  APPROVAL_POLICY,
  APPROVAL_POLICY_VALUES,
  APPROVER_STATUS,
  APPROVER_STATUS_VALUES,
} from '../../config/constants.js';

const { Schema } = mongoose;

/** One approver's decision step within a request. */
const approverSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Approver is required'],
    },
    status: {
      type: String,
      enum: APPROVER_STATUS_VALUES,
      default: APPROVER_STATUS.PENDING,
    },
    comment: { type: String, trim: true, maxlength: 2000, default: null },
    decidedAt: { type: Date, default: null },
  },
  { _id: true }
);

const approvalSchema = new Schema(
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
    status: {
      type: String,
      enum: APPROVAL_STATUS_VALUES,
      default: APPROVAL_STATUS.PENDING,
      index: true,
    },
    policy: {
      type: String,
      enum: APPROVAL_POLICY_VALUES,
      default: APPROVAL_POLICY.ALL,
    },
    // The request note from the requester (optional).
    note: { type: String, trim: true, maxlength: 2000, default: null },
    approvers: {
      type: [approverSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one approver is required',
      },
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // When the request reached a terminal state (approved/rejected/cancelled).
    decidedAt: { type: Date, default: null },
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

// Common access pattern: list within one org, newest first.
approvalSchema.index({ organization: 1, createdAt: -1 });
// Enforce a single active (pending) request per document at the DB level.
approvalSchema.index(
  { document: 1 },
  {
    name: 'document_pending_unique',
    unique: true,
    partialFilterExpression: { status: APPROVAL_STATUS.PENDING },
  }
);

const ApprovalRequest = mongoose.model('ApprovalRequest', approvalSchema);

export default ApprovalRequest;
