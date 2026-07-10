/**
 * User-administration API calls (Module 2). Each returns the unwrapped payload
 * from the backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET   /users            → { users } + meta { page, limit, total, pages }
 *  - GET   /users/:id        → { user }
 *  - PATCH /users/:id/role   → { user }
 *  - PATCH /users/:id/status → { user }
 */
import { api } from '@/lib/api';

/** Drop empty/undefined params so the strict backend query schema stays happy. */
function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

export async function listUsers(params = {}) {
  const { data } = await api.get('/users', { params: cleanParams(params) });
  return { users: data.data.users, meta: data.meta };
}

export async function getUser(id) {
  const { data } = await api.get(`/users/${id}`);
  return data.data.user;
}

export async function updateUserRole(id, role) {
  const { data } = await api.patch(`/users/${id}/role`, { role });
  return data.data.user;
}

export async function updateUserStatus(id, status) {
  const { data } = await api.patch(`/users/${id}/status`, { status });
  return data.data.user;
}
