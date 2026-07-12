/**
 * AI assistant API calls (Module 16). Each returns the unwrapped payload from
 * the backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - POST /ai/assist          → { completion, cached }
 *  - GET  /ai/completions     → { completions } + meta
 *  - GET  /ai/completions/:id → { completion }
 */
import { api, cleanParams } from '@/lib/api';

/**
 * Run an assistive text operation. `payload` = { operation, input, tone? }.
 * Returns { completion, cached }.
 */
export async function requestAiAssist(payload) {
  const { data } = await api.post('/ai/assist', payload);
  return data.data;
}

export async function listAiCompletions(params = {}) {
  const { data } = await api.get('/ai/completions', { params: cleanParams(params) });
  return { completions: data.data.completions, meta: data.meta };
}

export async function getAiCompletion(id) {
  const { data } = await api.get(`/ai/completions/${id}`);
  return data.data.completion;
}
