/**
 * Zod schemas for the notification endpoints (Module 13).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { NOTIFICATION_TYPE_VALUES } from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const notificationIdParamSchema = z.object({ id: objectId('notification id') }).strict();

export const listNotificationsQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt']),
  type: z.enum(NOTIFICATION_TYPE_VALUES).optional(),
  status: z.enum(['read', 'unread']).optional(),
});
