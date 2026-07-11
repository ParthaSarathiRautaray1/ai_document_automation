/**
 * Zod schemas for the user-administration endpoints (Module 2).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { ROLE_VALUES, USER_STATUS, USER_STATUS_VALUES } from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const userIdParamSchema = z
  .object({
    id: objectId('user id'),
  })
  .strict();

// Free-text search across name + email (case-insensitive).
export const listUsersQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt', 'email', '-email', 'role', '-role']),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(USER_STATUS_VALUES).optional(),
});

export const updateRoleSchema = z
  .object({
    role: z.enum(ROLE_VALUES),
  })
  .strict();

// Only active/suspended are settable here; `invited` is set by the invite flow
// (Module 3), not by an admin toggling status.
export const updateStatusSchema = z
  .object({
    status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED]),
  })
  .strict();
