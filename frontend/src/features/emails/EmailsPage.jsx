import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, RefreshCw, Search } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useAuthStore } from '@/store/authStore';
import { listEmails, retryEmail } from './emails.api';

const PAGE_SIZE = 20;
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

/** Debounce a rapidly-changing value (e.g. a search box) by `delay` ms. */
function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

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

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const canRetry = can(PERMISSIONS.EMAIL_RETRY);

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, q: q || undefined, status: status || undefined }),
    [page, q, status]
  );

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
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  className="pl-9"
                  type="search"
                  placeholder="Search by subject or recipient"
                  aria-label="Search emails"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                className="sm:w-40"
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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
            {meta && meta.pages > 1 ? (
              <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                <span>
                  Page {meta.page} of {meta.pages} · {meta.total} email{meta.total === 1 ? '' : 's'}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1 || emailsQuery.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page >= meta.pages || emailsQuery.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
