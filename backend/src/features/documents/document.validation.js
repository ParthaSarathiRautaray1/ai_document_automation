/**
 * Zod schemas for the document endpoints (Module 7).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { DOCUMENT_TYPE_VALUES, DOCUMENT_STATUS_VALUES } from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const documentIdParamSchema = z.object({ id: objectId('document id') }).strict();

// --- Shared field builders --------------------------------------------------

const tags = z.array(z.string().trim().min(1).max(40)).max(50).optional();

// A bag of values keyed by variable key. Values render as text, so
// numbers/booleans are accepted (and coerced by the engine).
const values = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({});

// --- Documents --------------------------------------------------------------

// Generate a document from a template. Title/type inherit from the template when
// omitted; status/tags/customer are optional overrides/links.
export const generateDocumentSchema = z
  .object({
    templateId: objectId('template id'),
    title: z.string().trim().min(1, 'Document title is required').max(200).optional(),
    customerId: objectId('customer id').nullish(),
    status: z.enum(DOCUMENT_STATUS_VALUES).optional(),
    values,
    tags,
  })
  .strict();

// Regenerate a document's content from its captured template snapshot using new
// values (nothing else changes).
export const regenerateDocumentSchema = z.object({ values }).strict();

export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1, 'Document title is required').max(200).optional(),
    type: z.enum(DOCUMENT_TYPE_VALUES).optional(),
    status: z.enum(DOCUMENT_STATUS_VALUES).optional(),
    // Manual edits to the rendered output are allowed.
    content: z.string().min(1, 'Document content is required').max(200000).optional(),
    customerId: objectId('customer id').nullish(),
    tags,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

// Free-text search across title (case-insensitive).
export const listDocumentsQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt', 'title', '-title', 'status', '-status']),
  type: z.enum(DOCUMENT_TYPE_VALUES).optional(),
  status: z.enum(DOCUMENT_STATUS_VALUES).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  templateId: objectId('template id').optional(),
  customerId: objectId('customer id').optional(),
});
