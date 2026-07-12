/**
 * Settings API calls (Module 17). Each returns the unwrapped payload from the
 * backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET   /settings/me            → { user }
 *  - PATCH /settings/me            → { user }
 *  - POST  /settings/me/password   → null (sessions revoked — re-login required)
 *  - GET   /settings/organization  → { settings }
 *  - PATCH /settings/organization  → { settings }
 */
import { api } from '@/lib/api';

export async function getMySettings() {
  const { data } = await api.get('/settings/me');
  return data.data.user;
}

export async function updateMySettings(payload) {
  const { data } = await api.patch('/settings/me', payload);
  return data.data.user;
}

export async function changeMyPassword(payload) {
  const { data } = await api.post('/settings/me/password', payload);
  return data;
}

export async function getOrgSettings() {
  const { data } = await api.get('/settings/organization');
  return data.data.settings;
}

export async function updateOrgSettings(payload) {
  const { data } = await api.patch('/settings/organization', payload);
  return data.data.settings;
}
