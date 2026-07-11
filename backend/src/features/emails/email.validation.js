/**
 * Zod schemas for the email endpoints (Module 9).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { EMAIL_TYPE_VALUES, EMAIL_STATUS_VALUES } from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const emailIdParamSchema = z.object({ id: objectId('email id') }).strict();

// Deliver a document by email. Recipient is optional — when omitted it is
// resolved from the document's linked customer. `attachPdf` defaults to true.
export const sendDocumentSchema = z
  .object({
    to: z.string().trim().email('Enter a valid email address').max(254).optional(),
    toName: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().max(2000).optional(),
    attachPdf: z.boolean().optional(),
  })
  .strict();

// Free-text search across subject + recipient (case-insensitive).
export const listEmailsQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt', 'status', '-status', 'to', '-to']),
  type: z.enum(EMAIL_TYPE_VALUES).optional(),
  status: z.enum(EMAIL_STATUS_VALUES).optional(),
  documentId: objectId('document id').optional(),
});
