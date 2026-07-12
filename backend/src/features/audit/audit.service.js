/**
 * Audit service (Module 14 — Audit Logs). Pure business logic (no req/res).
 *
 * Two responsibilities:
 *  1. An internal emit API (`recordAudit`) other services call to append an
 *     entry to the organization's activity trail. Recording is BEST-EFFORT: it
 *     never throws, so an audit failure can never break the action that produced
 *     it (mirrors the notification emit contract).
 *  2. A read API (`listAuditLogs` / `getAuditLogById`) for administrators. Both
 *     are tenant-scoped — an admin sees the whole org's trail, but never another
 *     org's (`super_admin` is global).
 */
import AuditLog from './audit.model.js';
import logger from '../../config/logger.js';
import ApiError from '../../utils/ApiError.js';
import { orgScope, listResources } from '../../utils/query.js';

/** Build a display name from an actor, falling back to their email. */
function actorDisplayName(actor) {
  if (!actor) return null;
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim();
  return name || actor.email || null;
}

/**
 * Append an entry to the organization's audit trail. Best-effort — returns the
 * persisted log (JSON) or `null` if it could not be written (the error is
 * logged, never thrown).
 *
 * @param {object} actor - the authenticated user performing the action
 * @param {object} entry
 * @param {string} [entry.organization] - defaults to the actor's org
 * @param {string} entry.action - a `<entity>.<verb>` action string
 * @param {string} entry.entityType - an AUDIT_ENTITY_TYPE
 * @param {string} [entry.entityId] - id of the targeted entity
 * @param {string} [entry.entityLabel] - display label (e.g. document title)
 * @param {object} [entry.metadata] - contextual payload
 * @returns {Promise<object|null>}
 */
export async function recordAudit(
  actor,
  { organization, action, entityType, entityId = null, entityLabel = null, metadata = {} }
) {
  try {
    // Audit entries are org-scoped; with no organization there is nothing to
    // attach the entry to (e.g. a super_admin acting out of band).
    const org = organization ?? actor?.organization ?? null;
    if (!org) return null;

    const log = await AuditLog.create({
      organization: org,
      actor: actor?.id ?? null,
      actorName: actorDisplayName(actor),
      actorEmail: actor?.email ?? null,
      action,
      entityType,
      entityId,
      entityLabel,
      metadata,
    });
    return log.toJSON();
  } catch (err) {
    logger.error(`[audit] record failed for action ${action}: ${err?.message ?? err}`);
    return null;
  }
}

/**
 * List audit log entries with pagination and optional filtering by `action`,
 * `entityType`, a specific `entityId`, or `actorId`, plus free-text search over
 * the action and entity/actor labels. Scoped to the actor's org.
 */
export async function listAuditLogs(
  actor,
  { page, limit, sort, q, action, entityType, entityId, actorId }
) {
  return listResources(AuditLog, 'auditLogs', {
    actor,
    page,
    limit,
    sort,
    filters: { action, entityType, entityId, actor: actorId },
    q,
    searchFields: ['action', 'entityLabel', 'actorName'],
  });
}

/** A single audit log entry by id, scoped to the actor's org. */
export async function getAuditLogById(actor, id) {
  const log = await AuditLog.findOne({ _id: id, ...orgScope(actor) });
  if (!log) {
    throw ApiError.notFound('Audit log entry not found', { code: 'AUDIT_LOG_NOT_FOUND' });
  }
  return log.toJSON();
}
