/**
 * Transactional email templates.
 *
 * Each builder returns `{ subject, html, text }`. HTML uses inline styles only
 * (email clients strip <style> blocks and ignore external CSS). A plain-text
 * alternative is always provided for accessibility and spam-score reasons.
 */
import env from '../config/env.js';

/** Escape user-supplied strings before interpolating into HTML. */
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Password-reset email.
 * @param {{ firstName?: string }} user
 * @param {string} resetUrl - Full client URL carrying the plaintext token.
 * @param {number} expiresInMin - Token lifetime, for the copy.
 */
export function passwordResetEmail(user, resetUrl, expiresInMin = env.RESET_TOKEN_EXPIRES_MIN) {
  const name = escapeHtml(user?.firstName || 'there');
  const safeUrl = escapeHtml(resetUrl);
  const subject = 'Reset your DocFlow AI password';

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e7eb;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <span style="font-size:18px;font-weight:700;color:#2563eb;">DocFlow&nbsp;AI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:#111827;">Reset your password</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">
                  Hi ${name}, we received a request to reset the password for your DocFlow&nbsp;AI account.
                  Click the button below to choose a new one. This link expires in
                  <strong>${expiresInMin} minutes</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 24px 32px;">
                <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;">Reset password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  If the button doesn't work, copy and paste this URL into your browser:
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;color:#2563eb;">${safeUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;border-top:1px solid #e4e7eb;">
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#9aa5b1;">
                  Didn't request this? You can safely ignore this email — your password won't change.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#9aa5b1;">&copy; DocFlow AI</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${user?.firstName || 'there'},`,
    '',
    'We received a request to reset the password for your DocFlow AI account.',
    `Open the link below to choose a new password (expires in ${expiresInMin} minutes):`,
    '',
    resetUrl,
    '',
    "Didn't request this? You can safely ignore this email — your password won't change.",
    '',
    '— DocFlow AI',
  ].join('\n');

  return { subject, html, text };
}

/**
 * Member-invitation email.
 * @param {{ firstName?: string }} user - the invitee
 * @param {string} inviteUrl - Full client URL carrying the plaintext invite token.
 * @param {{ inviterName?: string, orgName?: string }} context
 */
export function invitationEmail(user, inviteUrl, { inviterName, orgName } = {}) {
  const name = escapeHtml(user?.firstName || 'there');
  const safeUrl = escapeHtml(inviteUrl);
  const org = escapeHtml(orgName || 'a DocFlow AI organization');
  const inviter = escapeHtml(inviterName || 'A teammate');
  const subject = `You've been invited to join ${orgName || 'DocFlow AI'}`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e7eb;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <span style="font-size:18px;font-weight:700;color:#2563eb;">DocFlow&nbsp;AI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:#111827;">You're invited to ${org}</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">
                  Hi ${name}, ${inviter} has invited you to join <strong>${org}</strong> on DocFlow&nbsp;AI.
                  Click below to set your password and activate your account.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 24px 32px;">
                <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;">Accept invitation</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  If the button doesn't work, copy and paste this URL into your browser:
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;color:#2563eb;">${safeUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;border-top:1px solid #e4e7eb;">
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#9aa5b1;">
                  Weren't expecting this? You can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#9aa5b1;">&copy; DocFlow AI</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${user?.firstName || 'there'},`,
    '',
    `${inviterName || 'A teammate'} has invited you to join ${orgName || 'a DocFlow AI organization'} on DocFlow AI.`,
    'Open the link below to set your password and activate your account:',
    '',
    inviteUrl,
    '',
    "Weren't expecting this? You can safely ignore this email.",
    '',
    '— DocFlow AI',
  ].join('\n');

  return { subject, html, text };
}

/**
 * Document-delivery email (Module 9). Delivers a generated document to a
 * recipient — typically as an attached PDF, with an optional cover note.
 * @param {{ title?: string, type?: string }} document
 * @param {{ senderName?: string, orgName?: string, message?: string, hasAttachment?: boolean }} context
 */
export function documentDeliveryEmail(
  document,
  { senderName, orgName, message, hasAttachment = true } = {}
) {
  const title = escapeHtml(document?.title || 'your document');
  const org = escapeHtml(orgName || env.EMAIL_FROM_NAME);
  const sender = escapeHtml(senderName || org);
  const note = message ? escapeHtml(message) : '';
  const subject = `${orgName || env.EMAIL_FROM_NAME}: ${document?.title || 'Your document'}`;

  const attachmentLine = hasAttachment
    ? 'The document is attached to this email as a PDF.'
    : 'The document is included below.';

  const noteBlock = note
    ? `<tr>
              <td style="padding:0 32px 16px 32px;">
                <div style="border-left:3px solid #2563eb;background:#f8fafc;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${note}</div>
              </td>
            </tr>`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e7eb;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <span style="font-size:18px;font-weight:700;color:#2563eb;">${org}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:#111827;">${title}</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">
                  ${sender} has sent you a document, <strong>${title}</strong>. ${attachmentLine}
                </p>
              </td>
            </tr>
            ${noteBlock}
            <tr>
              <td style="padding:0 32px 28px 32px;border-top:1px solid #e4e7eb;">
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#9aa5b1;">
                  Sent via DocFlow&nbsp;AI. If you weren't expecting this, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#9aa5b1;">&copy; DocFlow AI</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${senderName || orgName || env.EMAIL_FROM_NAME} has sent you a document: ${document?.title || 'your document'}.`,
    hasAttachment ? 'The document is attached to this email as a PDF.' : '',
    message ? '' : null,
    message || null,
    '',
    'Sent via DocFlow AI.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, html, text };
}
