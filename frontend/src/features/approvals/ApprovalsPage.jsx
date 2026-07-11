import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Pagination } from '@/components/Pagination';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiError } from '@/lib/api';
import { useListQuery } from '@/hooks/useListQuery';
import { useAuthStore } from '@/store/authStore';
import { listApprovals } from './approvals.api';
import { STATUS_BADGE, approverSummary } from './approval.helpers';

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

export default function ApprovalsPage() {
  const userId = useAuthStore((s) => s.user?.id);

  const { filters, setFilter, params, nextPage, prevPage } = useListQuery({
    filters: { status: '', mine: '' },
  });

  // "Assigned to me" reuses the backend approverId filter.
  const queryParams = { ...params };
  delete queryParams.mine;
  if (filters.mine === 'yes' && userId) queryParams.approverId = userId;

  const approvalsQuery = useQuery({
    queryKey: ['approvals', queryParams],
    queryFn: () => listApprovals(queryParams),
    placeholderData: keepPreviousData,
  });

  const approvals = approvalsQuery.data?.approvals ?? [];
  const meta = approvalsQuery.data?.meta;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>
              Documents routed for approval across your organization, with each request&rsquo;s
              status and approver decisions. Open a document to act on its request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                className="sm:w-44"
                aria-label="Filter by status"
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </Select>
              <Select
                className="sm:w-44"
                aria-label="Filter by assignment"
                value={filters.mine}
                onChange={(e) => setFilter('mine', e.target.value)}
              >
                <option value="">All requests</option>
                <option value="yes">Assigned to me</option>
              </Select>
            </div>

            {/* Table states */}
            {approvalsQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading approvals" />
              </div>
            ) : approvalsQuery.isError ? (
              <Alert>{getApiError(approvalsQuery.error).message}</Alert>
            ) : approvals.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No approval requests match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Approvers</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/documents/${a.document}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          View document
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{a.policy}</TableCell>
                      <TableCell className="text-muted-foreground">{approverSummary(a)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[a.status] ?? 'default'}>{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            <Pagination
              meta={meta}
              busy={approvalsQuery.isFetching}
              onPrev={prevPage}
              onNext={nextPage}
              noun="approval"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
