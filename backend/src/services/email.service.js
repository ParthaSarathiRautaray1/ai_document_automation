/**
 * Email service — sends transactional email via the Brevo (Sendinblue) REST API.
 *
 * Design notes:
 *  - Uses the native `fetch` (Node >= 20); no extra HTTP dependency.
 *  - When `BREVO_API_KEY` is not configured (local dev, CI, tests) the send is
 *    SKIPPED rather than failing — the message is logged instead so flows remain
 *    usable without a real provider. This also keeps the test suite hermetic
 *    (no outbound network calls).
 *  - A request timeout guards against a hung provider.
 */
import env from '../config/env.js';
import logger from '../config/logger.js';
import { passwordResetEmail, invitationEmail } from './email.templates.js';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Low-level send. Returns a result object rather than throwing on a skipped
 * send; throws only on a genuine provider/network failure.
 * @param {{ to:string, toName?:string, subject:string, html:string, text?:string, attachments?:Array<{ name:string, content:string }> }} message
 *   `attachments[].content` is base64-encoded file content (Brevo's format).
 * @returns {Promise<{ delivered:boolean, skipped?:boolean, messageId?:string|null }>}
 */
export async function sendTransactionalEmail({ to, toName, subject, html, text, attachments }) {
  if (!env.BREVO_API_KEY) {
    logger.warn(`[email] BREVO_API_KEY not set — skipping send of "${subject}" to ${to}`);
    return { delivered: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
        textContent: text,
        ...(attachments?.length ? { attachment: attachments } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Brevo responded ${response.status} ${response.statusText}: ${body}`);
    }

    const data = await response.json().catch(() => ({}));
    logger.info(`[email] sent "${subject}" to ${to} (messageId=${data.messageId ?? 'n/a'})`);
    return { delivered: true, messageId: data.messageId ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send the password-reset email.
 * @param {{ email:string, firstName?:string }} user
 * @param {string} resetUrl - Full client URL containing the plaintext token.
 */
export async function sendPasswordResetEmail(user, resetUrl) {
  // Surface the link in non-production logs so developers can test without a
  // configured email provider. Never logged in production.
  if (!env.isProduction) {
    logger.info(`[email] password reset link for ${user.email}: ${resetUrl}`);
  }
  const { subject, html, text } = passwordResetEmail(user, resetUrl);
  return sendTransactionalEmail({
    to: user.email,
    toName: user.fullName || user.firstName,
    subject,
    html,
    text,
  });
}

/**
 * Send a member-invitation email.
 * @param {{ email:string, firstName?:string, fullName?:string }} user - the invitee
 * @param {string} inviteUrl - Full client URL containing the plaintext invite token.
 * @param {{ inviterName?: string, orgName?: string }} context
 */
export async function sendInvitationEmail(user, inviteUrl, context = {}) {
  if (!env.isProduction) {
    logger.info(`[email] invitation link for ${user.email}: ${inviteUrl}`);
  }
  const { subject, html, text } = invitationEmail(user, inviteUrl, context);
  return sendTransactionalEmail({
    to: user.email,
    toName: user.fullName || user.firstName,
    subject,
    html,
    text,
  });
}
