/**
 * Central HTTP layer — a single Axios instance shared by the whole app.
 *
 * Token strategy (mirrors the backend, ADR-0007):
 *  - The ACCESS token lives in memory only (never localStorage) to limit XSS
 *    blast radius. It is attached as `Authorization: Bearer` on every request.
 *  - The REFRESH token is an httpOnly cookie the browser sends automatically;
 *    `withCredentials: true` opts into that. JS never reads it.
 *  - On a 401, one silent refresh is attempted (single-flight, so concurrent
 *    401s share it), the access token is replaced, and the original request is
 *    retried once. If refresh fails, the session is cleared via the registered
 *    unauthorized handler (the auth store wires this up).
 */
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

let accessToken = null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

/** Register a callback invoked when a refresh attempt fails (forces logout). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export const api = axios.create({ baseURL, withCredentials: true });

// Bare client for the refresh call itself — no interceptors, so a failing
// refresh can't recurse back into this same 401 handler.
const refreshClient = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Endpoints that must never trigger the refresh-and-retry dance (a 401 from
// them is a real credential failure, not an expired session).
const AUTH_FREE_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

let refreshPromise = null;

/** Perform (or join) a single in-flight refresh; resolves to the new token. */
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh')
      .then((res) => {
        const token = res.data?.data?.accessToken ?? null;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    if (!response || !config) return Promise.reject(error);

    const isAuthFree = AUTH_FREE_PATHS.some((p) => (config.url || '').includes(p));

    if (response.status === 401 && !config._retry && !isAuthFree) {
      config._retry = true;
      try {
        const token = await refreshAccessToken();
        if (!token) throw new Error('Session expired');
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch (refreshError) {
        setAccessToken(null);
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Drop empty/undefined/null params so the strict backend query schemas stay
 * happy (they reject unknown/blank keys). Shared by every list API call.
 */
export function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

/**
 * Normalize an Axios error into the app's error envelope so UI code can render
 * a message (and inspect `code`/`details`) without knowing about Axios.
 */
export function getApiError(error) {
  const data = error?.response?.data;
  return {
    message: data?.message || error?.message || 'Something went wrong. Please try again.',
    code: data?.code || null,
    details: Array.isArray(data?.details) ? data.details : null,
    status: error?.response?.status ?? null,
  };
}
