/**
 * Audit log API calls (Module 14). Each returns the unwrapped payload from the
 * backend's `{ success, message, data, meta }` envelope. Read-only — audit logs
 * are written server-side by the actions they record.
 *
 * Backend contracts:
 *  - GET /audit-logs      → { auditLogs } + meta
 *  - GET /audit-logs/:id  → { auditLog }
 */
import { api, cleanParams } from '@/lib/api';

export async function listAuditLogs(params = {}) {
  const { data } = await api.get('/audit-logs', { params: cleanParams(params) });
  return { auditLogs: data.data.auditLogs, meta: data.meta };
}

export async function getAuditLog(id) {
  const { data } = await api.get(`/audit-logs/${id}`);
  return data.data.auditLog;
}
