/**
 * Email message model (Module 9 — Email Service).
 *
 * Every transactional email routed through the queue is persisted here, giving
 * the organization an observable log with delivery status and retry accounting.
 * Records are strictly tenant-scoped — each belongs to exactly one
 * `organization`, and all queries are confined to the caller's org (see
 * email.service.js).
 *
 * The rendered `html`/`text` are stored so a message can be re-sent on retry
 * without rebuilding it. Binary attachments (e.g. a document PDF) are NOT stored;
 * when `attachPdf` is set they are regenerated from the linked `document` at
 * send time, keeping records small.
 */
import mongoose from 'mongoose';
import {
  EMAIL_TYPE,
  EMAIL_TYPE_VALUES,
  EMAIL_STATUS,
  EMAIL_STATUS_VALUES,
  EMAIL_MAX_ATTEMPTS,
} from '../../config/constants.js';

const { Schema } = mongoose;

const emailMessageSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    to: {
      type: String,
      required: [true, 'Recipient address is required'],
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    toName: { type: String, trim: true, maxlength: 200, default: null },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 300,
    },
    type: {
      type: String,
      enum: EMAIL_TYPE_VALUES,
      default: EMAIL_TYPE.OTHER,
      index: true,
    },
    status: {
      type: String,
      enum: EMAIL_STATUS_VALUES,
      default: EMAIL_STATUS.QUEUED,
      index: true,
    },
    // Rendered body, kept so the message can be re-sent on retry.
    html: { type: String, default: '', maxlength: 200000 },
    text: { type: String, default: null, maxlength: 200000 },
    // Optional link to the document this email delivers.
    document: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
      index: true,
    },
    // When true, the linked document's PDF is (re)generated and attached at send.
    attachPdf: { type: Boolean, default: false },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: EMAIL_MAX_ATTEMPTS, min: 1 },
    lastError: { type: String, default: null, maxlength: 2000 },
    providerMessageId: { type: String, default: null },
    sentAt: { type: Date, default: null },
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

// Common access pattern: list within one org, newest first.
emailMessageSchema.index({ organization: 1, createdAt: -1 });

const EmailMessage = mongoose.model('EmailMessage', emailMessageSchema);

export default EmailMessage;
