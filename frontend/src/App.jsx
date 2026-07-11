import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';
import { RequirePermission } from '@/components/RequirePermission';
import { Spinner } from '@/components/ui/spinner';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';

import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/ResetPasswordPage';
import AcceptInvitePage from '@/features/auth/AcceptInvitePage';
import DashboardPage from '@/pages/DashboardPage';
import UsersPage from '@/features/users/UsersPage';
import OrganizationSettingsPage from '@/features/organizations/OrganizationSettingsPage';
import CustomersPage from '@/features/customers/CustomersPage';
import CustomerDetailPage from '@/features/customers/CustomerDetailPage';
import ProductsPage from '@/features/products/ProductsPage';
import ProductDetailPage from '@/features/products/ProductDetailPage';
import TemplatesPage from '@/features/templates/TemplatesPage';
import TemplateDetailPage from '@/features/templates/TemplateDetailPage';
import DocumentsPage from '@/features/documents/DocumentsPage';
import DocumentDetailPage from '@/features/documents/DocumentDetailPage';
import EmailsPage from '@/features/emails/EmailsPage';
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
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route element={<RequirePermission permission={PERMISSIONS.USER_READ} />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
        <Route element={<RequirePermission permission={PERMISSIONS.ORG_READ} />}>
          <Route path="/organization" element={<OrganizationSettingsPage />} />
        </Route>
        <Route element={<RequirePermission permission={PERMISSIONS.CUSTOMER_READ} />}>
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
        </Route>
        <Route element={<RequirePermission permission={PERMISSIONS.PRODUCT_READ} />}>
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Route>
        <Route element={<RequirePermission permission={PERMISSIONS.TEMPLATE_READ} />}>
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/:id" element={<TemplateDetailPage />} />
        </Route>
        <Route element={<RequirePermission permission={PERMISSIONS.DOCUMENT_READ} />}>
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
        </Route>
        <Route element={<RequirePermission permission={PERMISSIONS.EMAIL_READ} />}>
          <Route path="/emails" element={<EmailsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
