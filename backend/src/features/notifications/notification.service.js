/**
 * Notification service (Module 13 — Notifications). Pure business logic (no req/res).
 *
 * Two responsibilities:
 *  1. An internal emit API (`createNotification` / `notifyUsers`) other services
 *     call to raise an in-app notification — and, optionally, mirror it to email
 *     via the Module 9 queue. Emitting is BEST-EFFORT: it never throws, so a
 *     notification failure can never break the action that triggered it.
 *  2. A user-facing inbox API (`list` / `unreadCount` / `markRead` /
 *     `markAllRead` / `remove`). Every read/mutate is confined to the caller's
 *     OWN notifications (`recipient === actor.id`) within their org, so one user
 *     can never see or touch another's notifications.
 */
import Notification from './notification.model.js';
import User from '../users/user.model.js';
import { enqueueEmail, processMessage } from '../emails/email.queue.js';
import { notificationEmail } from '../../services/email.templates.js';
import logger from '../../config/logger.js';
import ApiError from '../../utils/ApiError.js';
import { orgScope, listResources } from '../../utils/query.js';
import { EMAIL_TYPE, NOTIFICATION_TYPE } from '../../config/constants.js';

/** Load a notification owned by the actor, or throw 404. */
async function loadNotification(actor, id) {
  const notification = await Notification.findOne({
    _id: id,
    recipient: actor.id,
    ...orgScope(actor),
  });
  if (!notification) {
    throw ApiError.notFound('Notification not found', { code: 'NOTIFICATION_NOT_FOUND' });
  }
  return notification;
}

/**
 * Mirror an in-app notification to the recipient's email via the queue.
 * Best-effort: swallows all errors (logged) so it can never break the caller.
 */
async function sendNotificationEmail(notification) {
  try {
    const user = await User.findById(notification.recipient).select('email firstName');
    if (!user?.email) return;

    const { subject, html, text } = notificationEmail(notification, { firstName: user.firstName });
    const message = await enqueueEmail({
      organization: notification.organization,
      to: user.email,
      toName: user.firstName ?? null,
      subject,
      html,
      text,
      type: EMAIL_TYPE.NOTIFICATION,
      createdBy: notification.actor ?? null,
    });
    await processMessage(message);
  } catch (err) {
    logger.error(`[notification] email mirror failed: ${err?.message ?? err}`);
  }
}

/**
 * Create an in-app notification for a single recipient, optionally mirroring it
 * to email. Best-effort — returns the persisted notification (JSON) or `null`
 * if it could not be created (the error is logged, never thrown).
 *
 * @param {object} payload
 * @param {string} payload.organization
 * @param {string} payload.recipient
 * @param {string} [payload.type]  - a NOTIFICATION_TYPE (defaults to `system`)
 * @param {string} payload.title
 * @param {string} [payload.body]
 * @param {string} [payload.link]  - client-side deep-link path
 * @param {object} [payload.data]  - contextual ids for the client
 * @param {string} [payload.actor] - the user who triggered it
 * @param {boolean} [payload.email] - also send an email mirror
 * @returns {Promise<object|null>}
 */
export async function createNotification({
  organization,
  recipient,
  type,
  title,
  body = null,
  link = null,
  data = {},
  actor = null,
  email = false,
}) {
  try {
    const notification = await Notification.create({
      organization,
      recipient,
      type: type ?? NOTIFICATION_TYPE.SYSTEM,
      title,
      body,
      link,
      data,
      actor,
    });

    if (email) await sendNotificationEmail(notification);
    return notification.toJSON();
  } catch (err) {
    logger.error(`[notification] create failed for recipient ${recipient}: ${err?.message ?? err}`);
    return null;
  }
}

/**
 * Emit the same notification to many recipients (ids de-duplicated). A recipient
 * equal to the triggering `actor` is skipped — you don't notify yourself of your
 * own action. Best-effort per recipient.
 * @param {Array<string|object>} recipientIds
 * @param {object} payload - see {@link createNotification} (minus `recipient`)
 */
export async function notifyUsers(recipientIds, payload) {
  const actorId = payload.actor ? String(payload.actor) : null;
  const unique = [...new Set((recipientIds ?? []).map(String))].filter((id) => id !== actorId);
  return Promise.all(unique.map((recipient) => createNotification({ ...payload, recipient })));
}

/**
 * List the actor's own notifications with pagination and optional filtering by
 * `type` and read `status` (`read` | `unread`). Scoped to `recipient === actor`.
 */
export async function listNotifications(actor, { page, limit, sort, type, status }) {
  const filters = { recipient: actor.id, type };
  if (status === 'unread') filters.readAt = null;
  else if (status === 'read') filters.readAt = { $ne: null };

  return listResources(Notification, 'notifications', {
    actor,
    page,
    limit,
    sort,
    filters,
  });
}

/** Count the actor's unread notifications. */
export async function getUnreadCount(actor) {
  const count = await Notification.countDocuments({
    recipient: actor.id,
    readAt: null,
    ...orgScope(actor),
  });
  return { unread: count };
}

/** Mark one of the actor's notifications as read (idempotent). */
export async function markRead(actor, id) {
  const notification = await loadNotification(actor, id);
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  return notification.toJSON();
}

/** Mark all of the actor's unread notifications as read. Returns the count updated. */
export async function markAllRead(actor) {
  const result = await Notification.updateMany(
    { recipient: actor.id, readAt: null, ...orgScope(actor) },
    { $set: { readAt: new Date() } }
  );
  return { updated: result.modifiedCount ?? 0 };
}

/** Delete one of the actor's notifications. */
export async function deleteNotification(actor, id) {
  const notification = await loadNotification(actor, id);
  await notification.deleteOne();
}
