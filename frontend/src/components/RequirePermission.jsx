import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Route gate for a required permission. Assumes it renders *inside*
 * `ProtectedRoute` (so the user is already authenticated); a user lacking the
 * permission is bounced to the dashboard rather than the login page. The
 * backend still enforces the permission on every request — this only avoids
 * rendering a page the user can't use.
 */
export function RequirePermission({ permission }) {
  const can = useAuthStore((s) => s.can);
  if (!can(permission)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
