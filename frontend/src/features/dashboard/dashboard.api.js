/**
 * Dashboard / analytics API calls (Module 15). Each returns the unwrapped
 * payload from the backend's `{ success, message, data, meta }` envelope.
 * Read-only — the dashboard aggregates data the other modules own.
 *
 * Backend contracts:
 *  - GET /analytics/summary → { summary }
 *  - GET /analytics/recent  → { documents }
 */
import { api, cleanParams } from '@/lib/api';

export async function getDashboardSummary() {
  const { data } = await api.get('/analytics/summary');
  return data.data.summary;
}

export async function getRecentDocuments(params = {}) {
  const { data } = await api.get('/analytics/recent', { params: cleanParams(params) });
  return data.data.documents;
}
