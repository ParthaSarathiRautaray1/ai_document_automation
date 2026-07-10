/**
 * Global auth state (Zustand).
 *
 * The access token itself is held in the api layer's memory, not here — this
 * store keeps the user profile and a coarse status the router reacts to. On app
 * load, `bootstrap()` silently re-authenticates using the httpOnly refresh
 * cookie, so a page reload restores the session without persisting tokens to
 * localStorage.
 */
import { create } from 'zustand';
import { setAccessToken, setUnauthorizedHandler, refreshAccessToken } from '@/lib/api';
import { fetchCurrentUser, logoutRequest } from '@/features/auth/auth.api';
import { hasPermission } from '@/lib/permissions';

export const useAuthStore = create((set, get) => ({
  user: null,
  // The tenant the user belongs to (Module 3), or null. Surfaced by the backend
  // identity responses alongside the user.
  organization: null,
  // Capability strings the backend granted this user's role. Drives
  // permission-aware rendering; the server still enforces every action.
  permissions: [],
  // 'idle' → not yet checked · 'loading' → checking · 'authenticated' · 'unauthenticated'
  status: 'idle',

  /** Establish a session from a successful login/register response. */
  setSession: ({ user, organization, accessToken, permissions }) => {
    if (accessToken !== undefined) setAccessToken(accessToken);
    set({ user, organization: organization ?? null, permissions: permissions ?? [], status: 'authenticated' });
  },

  /** Drop the session locally (also clears the in-memory access token). */
  clearSession: () => {
    setAccessToken(null);
    set({ user: null, organization: null, permissions: [], status: 'unauthenticated' });
  },

  setUser: (user) => set({ user }),

  /** Replace the cached organization (e.g. after editing org settings). */
  setOrganization: (organization) => set({ organization }),

  /** Whether the current user holds a given permission. */
  can: (permission) => hasPermission(get().permissions, permission),

  /** Silent re-auth on startup via the refresh cookie. */
  bootstrap: async () => {
    set({ status: 'loading' });
    try {
      const token = await refreshAccessToken();
      if (!token) throw new Error('No active session');
      const { user, organization, permissions } = await fetchCurrentUser();
      set({ user, organization: organization ?? null, permissions: permissions ?? [], status: 'authenticated' });
    } catch {
      setAccessToken(null);
      set({ user: null, organization: null, permissions: [], status: 'unauthenticated' });
    }
  },

  /** Best-effort server logout, then clear locally regardless of the result. */
  logout: async () => {
    try {
      await logoutRequest();
    } catch {
      // Network/expired-token errors are fine — we clear the client either way.
    }
    get().clearSession();
  },
}));

// When a silent refresh fails inside the api layer, force the store to logout.
setUnauthorizedHandler(() => {
  useAuthStore.getState().clearSession();
});
