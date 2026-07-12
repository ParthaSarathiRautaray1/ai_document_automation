import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/AppHeader';
import { Pagination } from '@/components/Pagination';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { useListQuery } from '@/hooks/useListQuery';
import { listAuditLogs } from './audit.api';
import { ACTION_LABEL, ENTITY_BADGE, ENTITY_TYPES, timeAgo } from './audit.helpers';

export default function AuditLogsPage() {
  const { search, setSearch, filters, setFilter, params, nextPage, prevPage } = useListQuery({
    filters: { entityType: '' },
  });

  const auditQuery = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => listAuditLogs(params),
    placeholderData: keepPreviousData,
  });

  const logs = auditQuery.data?.auditLogs ?? [];
  const meta = auditQuery.data?.meta;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>
              A trail of who did what across your organization — document changes, approvals, and
              more. Read-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Search by action or entity"
                aria-label="Search audit log"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                className="sm:w-48"
                aria-label="Filter by entity type"
                value={filters.entityType}
                onChange={(e) => setFilter('entityType', e.target.value)}
              >
                <option value="">All entities</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </Select>
            </div>

            {/* Table states */}
            {auditQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading audit log" />
              </div>
            ) : auditQuery.isError ? (
              <Alert>{getApiError(auditQuery.error).message}</Alert>
            ) : logs.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No audit entries match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {timeAgo(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.actorName ?? log.actorEmail ?? 'System'}
                      </TableCell>
                      <TableCell>{ACTION_LABEL[log.action] ?? log.action}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <Badge variant={ENTITY_BADGE[log.entityType] ?? 'default'}>
                            {log.entityType}
                          </Badge>
                          {log.entityLabel ? (
                            <span className="text-muted-foreground">{log.entityLabel}</span>
                          ) : null}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            <Pagination
              meta={meta}
              busy={auditQuery.isFetching}
              onPrev={prevPage}
              onNext={nextPage}
              noun="event"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
