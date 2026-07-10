/**
 * Auth API calls. Each returns the unwrapped `data` payload from the backend's
 * `{ success, message, data }` envelope so callers work with plain values.
 */
import { api } from '@/lib/api';

export async function registerRequest(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data.data; // { user, organization, accessToken, refreshToken, permissions }
}

export async function loginRequest(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data.data; // { user, organization, accessToken, refreshToken, permissions }
}

export async function logoutRequest() {
  const { data } = await api.post('/auth/logout');
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data.data; // { user, organization, permissions }
}

export async function acceptInviteRequest(payload) {
  const { data } = await api.post('/auth/accept-invite', payload);
  return data.data; // { user, organization, accessToken, refreshToken, permissions }
}

export async function forgotPasswordRequest(payload) {
  const { data } = await api.post('/auth/forgot-password', payload);
  return data; // { success, message }
}

export async function resetPasswordRequest(payload) {
  const { data } = await api.post('/auth/reset-password', payload);
  return data; // { success, message }
}
