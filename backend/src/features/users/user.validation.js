/**
 * Zod schemas for the user-administration endpoints (Module 2).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { ROLE_VALUES, USER_STATUS_VALUES } from '../../config/constants.js';

/** 24-char hex Mongo ObjectId. */
const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid user id');

export const userIdParamSchema = z
  .object({
    id: objectId,
  })
  .strict();

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    // Whitelisted sort keys (field + direction), passed straight to Mongoose.
    sort: z
      .enum(['-createdAt', 'createdAt', 'email', '-email', 'role', '-role'])
      .default('-createdAt'),
    // Free-text search across name + email (case-insensitive).
    q: z.string().trim().min(1).max(120).optional(),
    role: z.enum(ROLE_VALUES).optional(),
    status: z.enum(USER_STATUS_VALUES).optional(),
  })
  .strict();
