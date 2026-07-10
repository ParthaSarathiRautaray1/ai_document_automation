import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/authStore';

import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/ResetPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="h-6 w-6 text-muted-foreground" label="Loading DocFlow AI" />
    </div>
  );
}

export default function App() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // Attempt a silent refresh once on load to restore an existing session.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Hold routing until the initial auth check settles (avoids a login flash).
  if (status === 'idle' || status === 'loading') {
    return <FullScreenLoader />;
  }

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
