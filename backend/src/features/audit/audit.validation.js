/**
 * Zod schemas for the audit-log endpoints (Module 14).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { AUDIT_ENTITY_TYPE_VALUES } from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const auditLogIdParamSchema = z.object({ id: objectId('audit log id') }).strict();

export const listAuditLogsQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt']),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.enum(AUDIT_ENTITY_TYPE_VALUES).optional(),
  entityId: objectId('entity id').optional(),
  actorId: objectId('actor id').optional(),
});
