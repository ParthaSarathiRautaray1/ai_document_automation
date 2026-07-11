/**
 * Email log API calls (Module 9). Each returns the unwrapped payload from the
 * backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET  /emails            → { emails } + meta
 *  - GET  /emails/:id        → { email }
 *  - POST /emails/:id/retry  → { email }
 */
import { api, cleanParams } from '@/lib/api';


export async function listEmails(params = {}) {
  const { data } = await api.get('/emails', { params: cleanParams(params) });
  return { emails: data.data.emails, meta: data.meta };
}

export async function getEmail(id) {
  const { data } = await api.get(`/emails/${id}`);
  return data.data.email;
}

export async function retryEmail(id) {
  const { data } = await api.post(`/emails/${id}/retry`);
  return data.data.email;
}
