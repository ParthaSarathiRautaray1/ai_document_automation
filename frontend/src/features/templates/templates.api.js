/**
 * Document template API calls (Module 6). Each returns the unwrapped payload
 * from the backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET    /templates          → { templates } + meta
 *  - POST   /templates          → { template }
 *  - GET    /templates/:id       → { template }
 *  - PATCH  /templates/:id       → { template }
 *  - DELETE /templates/:id       → null
 *  - POST   /templates/:id/render → { render: { content, missingRequired, ... } }
 */
import { api } from '@/lib/api';

/** Drop empty/undefined params so the strict backend query schema stays happy. */
function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

export async function listTemplates(params = {}) {
  const { data } = await api.get('/templates', { params: cleanParams(params) });
  return { templates: data.data.templates, meta: data.meta };
}

export async function getTemplate(id) {
  const { data } = await api.get(`/templates/${id}`);
  return data.data.template;
}

export async function createTemplate(payload) {
  const { data } = await api.post('/templates', payload);
  return data.data.template;
}

export async function updateTemplate(id, payload) {
  const { data } = await api.patch(`/templates/${id}`, payload);
  return data.data.template;
}

export async function deleteTemplate(id) {
  const { data } = await api.delete(`/templates/${id}`);
  return data;
}

export async function renderTemplate(id, values = {}) {
  const { data } = await api.post(`/templates/${id}/render`, { values });
  return data.data.render;
}
