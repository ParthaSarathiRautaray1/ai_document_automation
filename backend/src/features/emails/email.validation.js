/**
 * Zod schemas for the email endpoints (Module 9).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { EMAIL_TYPE_VALUES, EMAIL_STATUS_VALUES } from '../../config/constants.js';

/** 24-char hex Mongo ObjectId. */
const objectId = (label = 'id') => z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);

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

export const listEmailsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort: z
      .enum(['-createdAt', 'createdAt', 'status', '-status', 'to', '-to'])
      .default('-createdAt'),
    // Free-text search across subject + recipient (case-insensitive).
    q: z.string().trim().min(1).max(120).optional(),
    type: z.enum(EMAIL_TYPE_VALUES).optional(),
    status: z.enum(EMAIL_STATUS_VALUES).optional(),
    documentId: objectId('document id').optional(),
  })
  .strict();
