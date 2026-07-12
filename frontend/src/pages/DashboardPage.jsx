import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckSquare, Contact, Files, LayoutTemplate, Package } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';
import { getDashboardSummary, getRecentDocuments } from '@/features/dashboard/dashboard.api';
import { DOCUMENT_STATUS_BADGE, timeAgo } from '@/features/dashboard/dashboard.helpers';

/** A single headline metric tile. Optionally links to the underlying list. */
function StatTile({ icon: Icon, label, value, to }) {
  const body = (
    <Card
      className={cn(
        'h-full transition-colors',
        to && 'hover:border-primary/50 hover:bg-accent/40'
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="truncate text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);
  const canView = can(PERMISSIONS.ANALYTICS_READ);

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    enabled: canView,
  });

  const recentQuery = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => getRecentDocuments({ limit: 5 }),
    enabled: canView,
  });

  const summary = summaryQuery.data;
  const recent = recentQuery.data ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {user?.firstName || 'there'} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            An overview of your organization&apos;s activity.
          </p>
        </div>

        {!canView ? (
          <Alert variant="destructive">
            You don&apos;t have access to the dashboard analytics.
          </Alert>
        ) : summaryQuery.isError ? (
          <Alert variant="destructive">{getApiError(summaryQuery.error)}</Alert>
        ) : summaryQuery.isLoading ? (
          <div className="grid place-items-center py-16">
            <Spinner className="h-6 w-6 text-muted-foreground" label="Loading dashboard" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Headline metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile
                icon={Files}
                label="Documents"
                value={summary.documents.total}
                to="/documents"
              />
              <StatTile
                icon={Contact}
                label="Customers"
                value={summary.customers.total}
                to="/customers"
              />
              <StatTile
                icon={Package}
                label="Catalog"
                value={summary.products.total}
                to="/products"
              />
              <StatTile
                icon={LayoutTemplate}
                label="Templates"
                value={summary.templates.total}
                to="/templates"
              />
              <StatTile
                icon={CheckSquare}
                label="Pending approvals"
                value={summary.approvals.pending}
                to="/approvals"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Document status breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documents by status</CardTitle>
                  <CardDescription>How your documents are distributed.</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.documents.total === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {Object.entries(summary.documents.byStatus).map(([status, count]) => (
                        <li key={status} className="flex items-center justify-between text-sm">
                          <Badge variant={DOCUMENT_STATUS_BADGE[status] ?? 'default'}>
                            {status}
                          </Badge>
                          <span className="font-medium tabular-nums">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Recent activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent documents</CardTitle>
                  <CardDescription>The latest documents in your organization.</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentQuery.isLoading ? (
                    <div className="grid place-items-center py-6">
                      <Spinner className="h-5 w-5 text-muted-foreground" label="Loading" />
                    </div>
                  ) : recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent activity.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {recent.map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                          >
                            {doc.title}
                          </Link>
                          <Badge variant={DOCUMENT_STATUS_BADGE[doc.status] ?? 'default'}>
                            {doc.status}
                          </Badge>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {timeAgo(doc.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
