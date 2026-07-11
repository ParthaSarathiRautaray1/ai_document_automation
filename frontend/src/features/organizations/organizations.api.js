/**
 * Organization API calls (Module 3). Each returns the unwrapped payload from the
 * backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET    /organizations/me              → { organization }
 *  - PATCH  /organizations/me              → { organization }
 *  - GET    /organizations/members         → { members } + meta
 *  - POST   /organizations/members/invite  → { member }
 *  - DELETE /organizations/members/:id     → null
 */
import { api, cleanParams } from '@/lib/api';


export async function getMyOrganization() {
  const { data } = await api.get('/organizations/me');
  return data.data.organization;
}

export async function updateMyOrganization(payload) {
  const { data } = await api.patch('/organizations/me', payload);
  return data.data.organization;
}

export async function listMembers(params = {}) {
  const { data } = await api.get('/organizations/members', { params: cleanParams(params) });
  return { members: data.data.members, meta: data.meta };
}

export async function inviteMember(payload) {
  const { data } = await api.post('/organizations/members/invite', payload);
  return data.data.member;
}

export async function removeMember(id) {
  const { data } = await api.delete(`/organizations/members/${id}`);
  return data;
}
