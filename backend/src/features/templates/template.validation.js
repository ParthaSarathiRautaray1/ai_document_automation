/**
 * Zod schemas for the template endpoints (Module 6).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import {
  TEMPLATE_TYPE_VALUES,
  TEMPLATE_STATUS_VALUES,
  TEMPLATE_VARIABLE_TYPE_VALUES,
} from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const templateIdParamSchema = z.object({ id: objectId('template id') }).strict();

// --- Shared field builders --------------------------------------------------

const shortText = (max) => z.string().trim().max(max);
const tags = z.array(z.string().trim().min(1).max(40)).max(50).optional();

// A single declared variable. `defaultValue` accepts an empty string / null so a
// cleared UI field round-trips cleanly.
const templateVariableSchema = z
  .object({
    key: z
      .string({ required_error: 'Variable key is required' })
      .trim()
      .min(1, 'Variable key is required')
      .max(60)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Key must start with a letter and use only letters, numbers, and underscores'),
    label: shortText(120).nullish(),
    type: z.enum(TEMPLATE_VARIABLE_TYPE_VALUES).optional(),
    required: z.boolean().optional(),
    defaultValue: z.string().max(1000).nullish(),
    description: shortText(500).nullish(),
  })
  .strict();

// Reject duplicate keys within one variables array (mirrors the model guard).
const variables = z
  .array(templateVariableSchema)
  .max(100)
  .superRefine((list, ctx) => {
    const seen = new Set();
    list.forEach((variable, index) => {
      if (seen.has(variable.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate variable key "${variable.key}"`,
          path: [index, 'key'],
        });
      }
      seen.add(variable.key);
    });
  })
  .optional();

// --- Templates --------------------------------------------------------------

export const createTemplateSchema = z
  .object({
    name: z.string({ required_error: 'Template name is required' }).trim().min(1, 'Template name is required').max(200),
    description: shortText(2000).nullish(),
    type: z.enum(TEMPLATE_TYPE_VALUES).optional(),
    status: z.enum(TEMPLATE_STATUS_VALUES).optional(),
    content: z.string({ required_error: 'Template content is required' }).min(1, 'Template content is required').max(50000),
    variables,
    tags,
  })
  .strict();

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1, 'Template name is required').max(200).optional(),
    description: shortText(2000).nullish(),
    type: z.enum(TEMPLATE_TYPE_VALUES).optional(),
    status: z.enum(TEMPLATE_STATUS_VALUES).optional(),
    content: z.string().min(1, 'Template content is required').max(50000).optional(),
    variables,
    tags,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

// Free-text search across name + description (case-insensitive).
export const listTemplatesQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt', 'name', '-name', 'status', '-status']),
  type: z.enum(TEMPLATE_TYPE_VALUES).optional(),
  status: z.enum(TEMPLATE_STATUS_VALUES).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
});

// Render preview: a bag of values keyed by variable key. Values render as text,
// so numbers/booleans are accepted and coerced by the engine.
export const renderTemplateSchema = z
  .object({
    values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  })
  .strict();
