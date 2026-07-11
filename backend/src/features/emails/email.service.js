/**
 * Email feature service (Module 9). Pure business logic (no req/res).
 *
 * Ties the document layer to the email queue: delivering a document resolves a
 * recipient, renders a delivery email, (optionally) attaches the document's PDF,
 * and enqueues + attempts the send. It also exposes the org's email log (list /
 * detail) and a retry. Every operation is confined to the actor's organization
 * (tenant isolation): a message — or a document referenced during delivery — in
 * another org is reported as "not found", never leaked.
 */
import EmailMessage from './email.model.js';
import Customer from '../customers/customer.model.js';
import { enqueueEmail, processMessage } from './email.queue.js';
import { getDocumentById } from '../documents/document.service.js';
import { exportDocumentPdf } from '../documents/pdf.service.js';
import { documentDeliveryEmail } from '../../services/email.templates.js';
import ApiError from '../../utils/ApiError.js';
import { ROLES, EMAIL_TYPE, EMAIL_STATUS } from '../../config/constants.js';

/** Escape user input before using it in a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tenant-isolation filter. Confines every query to the actor's own organization.
 * `super_admin` is a global role and operates across all tenants.
 */
function orgScope(actor) {
  if (actor.role === ROLES.SUPER_ADMIN) return {};
  return { organization: actor.organization ?? null };
}

/** Require the actor to belong to an organization (emails are org-scoped). */
function requireOrganization(actor) {
  if (!actor.organization) {
    throw ApiError.badRequest('You must belong to an organization to send email', {
      code: 'NO_ORGANIZATION',
    });
  }
}

/** Load an email message scoped to the actor's org, or throw 404. */
async function loadMessage(actor, id) {
  const message = await EmailMessage.findOne({ _id: id, ...orgScope(actor) });
  if (!message) {
    throw ApiError.notFound('Email not found', { code: 'EMAIL_NOT_FOUND' });
  }
  return message;
}

/**
 * Resolve the recipient for a document delivery. An explicit `to` wins; otherwise
 * fall back to the linked customer's address (top-level email, then a primary/
 * first contact email). Throws 400 NO_RECIPIENT if none can be determined.
 * @returns {Promise<{ to:string, toName:string|null }>}
 */
async function resolveRecipient(actor, document, { to, toName }) {
  if (to) return { to, toName: toName ?? null };

  if (document.customer) {
    const customer = await Customer.findOne({ _id: document.customer, ...orgScope(actor) });
    if (customer) {
      if (customer.email) return { to: customer.email, toName: toName ?? customer.name };
      const contacts = customer.contacts ?? [];
      const contact = contacts.find((c) => c.isPrimary && c.email) || contacts.find((c) => c.email);
      if (contact?.email) return { to: contact.email, toName: toName ?? (contact.name || customer.name) };
    }
  }

  throw ApiError.badRequest('No recipient address: provide "to" or link a customer with an email', {
    code: 'NO_RECIPIENT',
  });
}

/** Build a base64 PDF attachment array for a document, or [] if not attaching. */
async function buildAttachments(actor, documentId, attachPdf) {
  if (!attachPdf) return [];
  const { filename, buffer } = await exportDocumentPdf(actor, documentId);
  return [{ name: filename, content: buffer.toString('base64') }];
}

/**
 * Deliver a generated document to a recipient by email. Enqueues the message,
 * then attempts the send (attaching the document PDF unless disabled).
 * @param {object} actor
 * @param {string} documentId
 * @param {{ to?:string, toName?:string, message?:string, attachPdf?:boolean }} options
 * @returns {Promise<object>} the persisted email message (JSON)
 */
export async function sendDocument(actor, documentId, options = {}) {
  requireOrganization(actor);

  // Tenant-scoped load (cross-org → 404 DOCUMENT_NOT_FOUND).
  const document = await getDocumentById(actor, documentId);
  const attachPdf = options.attachPdf !== false;

  const { to, toName } = await resolveRecipient(actor, document, options);
  const { subject, html, text } = documentDeliveryEmail(document, {
    orgName: null,
    senderName: actor.fullName || actor.firstName || null,
    message: options.message,
    hasAttachment: attachPdf,
  });

  const message = await enqueueEmail({
    organization: actor.organization,
    to,
    toName,
    subject,
    html,
    text,
    type: EMAIL_TYPE.DOCUMENT_DELIVERY,
    document: document.id,
    attachPdf,
    createdBy: actor.id,
  });

  const attachments = await buildAttachments(actor, document.id, attachPdf);
  await processMessage(message, attachments);
  return message.toJSON();
}

/**
 * List email messages with pagination, optional filtering (type/status/document)
 * and free-text search across subject + recipient. Scoped to the actor's org.
 */
export async function listEmails(actor, { page, limit, sort, q, type, status, documentId }) {
  const filter = { ...orgScope(actor) };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (documentId) filter.document = documentId;
  if (q) {
    const rx = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ subject: rx }, { to: rx }];
  }

  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    EmailMessage.find(filter).sort(sort).skip(skip).limit(limit),
    EmailMessage.countDocuments(filter),
  ]);

  return {
    emails: messages.map((m) => m.toJSON()),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** A single email message by id, scoped to the actor's org. */
export async function getEmailById(actor, id) {
  const message = await loadMessage(actor, id);
  return message.toJSON();
}

/**
 * Re-attempt delivery of a message that is not already sent. Rebuilds the PDF
 * attachment when the message carries one. Resets the status to `queued` so the
 * attempt budget is respected.
 */
export async function retryEmail(actor, id) {
  const message = await loadMessage(actor, id);

  if (message.status === EMAIL_STATUS.SENT) {
    throw ApiError.badRequest('This email was already sent', { code: 'EMAIL_ALREADY_SENT' });
  }

  const attachments =
    message.attachPdf && message.document
      ? await buildAttachments(actor, message.document, true)
      : [];

  message.status = EMAIL_STATUS.QUEUED;
  await processMessage(message, attachments);
  return message.toJSON();
}
