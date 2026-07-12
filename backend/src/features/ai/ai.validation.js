/**
 * Zod schemas for the AI assistant endpoints (Module 16).
 *
 * `assistSchema` validates a text operation over an input snippet; `change_tone`
 * additionally requires a `tone`. The history endpoints reuse the shared list
 * helpers.
 */
import { z } from 'zod';
import { listQuery, objectId, sortParam } from '../../utils/validation.js';
import {
  AI_OPERATION,
  AI_OPERATION_VALUES,
  AI_TONE_VALUES,
  AI_MAX_INPUT_CHARS,
} from '../../config/constants.js';

export const assistSchema = z
  .object({
    operation: z.enum(AI_OPERATION_VALUES),
    input: z
      .string()
      .trim()
      .min(1, 'Some text is required')
      .max(AI_MAX_INPUT_CHARS, `Text must be at most ${AI_MAX_INPUT_CHARS} characters`),
    tone: z.enum(AI_TONE_VALUES).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.operation === AI_OPERATION.CHANGE_TONE && !data.tone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tone'],
        message: 'A tone is required for the change_tone operation',
      });
    }
  });

export const listCompletionsQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt']),
  operation: z.enum(AI_OPERATION_VALUES).optional(),
});

export const completionIdParamSchema = z
  .object({ id: objectId('completion id') })
  .strict();
