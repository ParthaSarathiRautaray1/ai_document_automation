/**
 * Approval workflow API calls (Module 11). Each returns the unwrapped payload
 * from the backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET  /approvals                → { approvals } + meta
 *  - POST /approvals                → { approval }
 *  - GET  /approvals/:id            → { approval }
 *  - POST /approvals/:id/decision   → { approval }
 *  - POST /approvals/:id/cancel     → { approval }
 */
import { api, cleanParams } from '@/lib/api';

export async function listApprovals(params = {}) {
  const { data } = await api.get('/approvals', { params: cleanParams(params) });
  return { approvals: data.data.approvals, meta: data.meta };
}

export async function getApproval(id) {
  const { data } = await api.get(`/approvals/${id}`);
  return data.data.approval;
}

export async function requestApproval(payload) {
  const { data } = await api.post('/approvals', payload);
  return data.data.approval;
}

export async function decideApproval(id, payload) {
  const { data } = await api.post(`/approvals/${id}/decision`, payload);
  return data.data.approval;
}

export async function cancelApproval(id) {
  const { data } = await api.post(`/approvals/${id}/cancel`);
  return data.data.approval;
}
