import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppHeader } from '@/components/AppHeader';
import { useAuthStore } from '@/store/authStore';

/**
 * Authenticated landing page. Intentionally minimal — the full dashboard
 * (metrics, recent documents) arrives in Module 15. For now it confirms the
 * session and offers logout, proving the protected-route + auth flow end to end.
 */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.firstName || 'there'} 👋</CardTitle>
            <CardDescription>You&apos;re signed in to DocFlow AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
                <dd className="text-sm">{user?.fullName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
                <dd className="text-sm">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
                <dd className="text-sm capitalize">{user?.role?.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd className="text-sm capitalize">{user?.status}</dd>
              </div>
            </dl>
            <p className="mt-6 text-sm text-muted-foreground">
              The full dashboard — metrics, recent documents, and quick actions — lands in a later
              module. This screen confirms authentication, protected routing, and silent token refresh
              are working.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
