/**
 * Notification model (Module 13 — Notifications).
 *
 * An in-app notification delivered to a single user about something that
 * happened in their organization (a document routed for their approval, a
 * decision on a request they raised, …). Notifications are strictly
 * per-recipient AND tenant-scoped — each belongs to exactly one `organization`
 * and one `recipient`, and every query is confined to the caller's own
 * notifications (see notification.service.js).
 *
 * `readAt` doubles as the read flag: `null` = unread, a timestamp = read. An
 * optional `link` is a client-side path (e.g. `/documents/<id>`) the UI can deep
 * link to, and `data` carries arbitrary contextual ids for the frontend.
 */
import mongoose from 'mongoose';
import { NOTIFICATION_TYPE, NOTIFICATION_TYPE_VALUES } from '../../config/constants.js';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    // The user this notification is for.
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPE_VALUES,
      default: NOTIFICATION_TYPE.SYSTEM,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    body: { type: String, trim: true, maxlength: 2000, default: null },
    // A client-side deep-link path (e.g. `/documents/<id>`), optional.
    link: { type: String, trim: true, maxlength: 500, default: null },
    // Arbitrary contextual payload (e.g. { documentId, approvalId }).
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    // null = unread; set to a timestamp when the recipient reads it.
    readAt: { type: Date, default: null, index: true },
    // The user whose action triggered this notification (nullable).
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
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

// Common access pattern: a recipient's inbox within one org, newest first.
notificationSchema.index({ organization: 1, recipient: 1, createdAt: -1 });
// Fast unread lookups/counts per recipient.
notificationSchema.index({ recipient: 1, readAt: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
