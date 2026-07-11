/**
 * Email queue (Module 9 — Email Service).
 *
 * A lightweight, database-backed queue: an email is persisted as an
 * `EmailMessage` (status `queued`), then a send is attempted. Each attempt
 * updates the record's status and attempt count, so failures are observable and
 * retryable. There is no external broker — the "queue" is the collection itself,
 * which is enough for transactional volumes and keeps the stack simple.
 *
 * This module is deliberately provider-agnostic and knows nothing about
 * documents/PDFs: callers pass any binary `attachments` they want delivered.
 */
import EmailMessage from './email.model.js';
import { sendTransactionalEmail } from '../../services/email.service.js';
import logger from '../../config/logger.js';
import { EMAIL_STATUS } from '../../config/constants.js';

/**
 * Persist a new message in the `queued` state (no send attempted yet).
 * @param {object} data - EmailMessage fields (organization, to, subject, html, …)
 * @returns {Promise<import('mongoose').Document>}
 */
export async function enqueueEmail(data) {
  return EmailMessage.create({ ...data, status: EMAIL_STATUS.QUEUED });
}

/**
 * Attempt to deliver a persisted message once, updating its status and attempt
 * count. Never throws on a provider failure — the error is recorded on the
 * message and it is either left `queued` (retries remain) or marked `failed`.
 *
 * @param {import('mongoose').Document} message - a persisted EmailMessage
 * @param {Array<{ name:string, content:string }>} [attachments] - base64 attachments
 * @returns {Promise<import('mongoose').Document>} the updated message
 */
export async function processMessage(message, attachments = []) {
  message.status = EMAIL_STATUS.SENDING;
  message.attempts += 1;
  await message.save();

  try {
    const result = await sendTransactionalEmail({
      to: message.to,
      toName: message.toName,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments,
    });

    if (result.skipped) {
      // No provider configured (dev/CI): not a failure, but nothing was sent.
      message.status = EMAIL_STATUS.SKIPPED;
      message.sentAt = new Date();
    } else {
      message.status = EMAIL_STATUS.SENT;
      message.providerMessageId = result.messageId ?? null;
      message.sentAt = new Date();
      message.lastError = null;
    }
  } catch (err) {
    message.lastError = String(err?.message ?? err).slice(0, 2000);
    // Leave queued for another attempt until the budget is exhausted.
    message.status =
      message.attempts >= message.maxAttempts ? EMAIL_STATUS.FAILED : EMAIL_STATUS.QUEUED;
    logger.error(
      `[email] send failed for ${message.to} (attempt ${message.attempts}/${message.maxAttempts}): ${message.lastError}`
    );
  }

  await message.save();
  return message;
}
