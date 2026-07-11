import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, RefreshCw } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Pagination } from '@/components/Pagination';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
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
import { PERMISSIONS } from '@/lib/permissions';
import { useListQuery } from '@/hooks/useListQuery';
import { useAuthStore } from '@/store/authStore';
import { listEmails, retryEmail } from './emails.api';

// Map an email status to a badge variant.
const STATUS_BADGE = {
  sent: 'success',
  skipped: 'default',
  queued: 'warning',
  sending: 'warning',
  failed: 'destructive',
};
const STATUSES = ['queued', 'sending', 'sent', 'failed', 'skipped'];
// Statuses that can still be (re)attempted.
const RETRYABLE = new Set(['queued', 'failed', 'skipped']);

/** Retry button for a single row (own mutation so its spinner is isolated). */
function RetryButton({ id, onDone }) {
  const mutation = useMutation({ mutationFn: () => retryEmail(id), onSuccess: onDone });
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate();
      }}
    >
      {mutation.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
      Retry
    </Button>
  );
}

export default function EmailsPage() {
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();

  const { search, setSearch, filters, setFilter, params, nextPage, prevPage } = useListQuery({
    filters: { status: '' },
  });

  const canRetry = can(PERMISSIONS.EMAIL_RETRY);

  const emailsQuery = useQuery({
    queryKey: ['emails', params],
    queryFn: () => listEmails(params),
    placeholderData: keepPreviousData,
  });

  const emails = emailsQuery.data?.emails ?? [];
  const meta = emailsQuery.data?.meta;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['emails'] });

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Email log</CardTitle>
            <CardDescription>
              Transactional emails sent from your organization — document deliveries and more, with
              delivery status. Retry any that failed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Search by subject or recipient"
                aria-label="Search emails"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                className="sm:w-40"
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
            </div>

            {/* Table states */}
            {emailsQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading emails" />
              </div>
            ) : emailsQuery.isError ? (
              <Alert>{getApiError(emailsQuery.error).message}</Alert>
            ) : emails.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No emails match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    {canRetry ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {m.subject}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.to}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[m.status] ?? 'default'}>{m.status}</Badge>
                      </TableCell>
                      {canRetry ? (
                        <TableCell className="text-right">
                          {RETRYABLE.has(m.status) ? <RetryButton id={m.id} onDone={invalidate} /> : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            <Pagination
              meta={meta}
              busy={emailsQuery.isFetching}
              onPrev={prevPage}
              onNext={nextPage}
              noun="email"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
