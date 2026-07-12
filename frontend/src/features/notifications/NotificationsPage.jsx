import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, CheckCheck, Trash2 } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Pagination } from '@/components/Pagination';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useListQuery } from '@/hooks/useListQuery';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from './notifications.api';
import { TYPE_BADGE, TYPE_LABEL, timeAgo } from './notification.helpers';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];
const TYPES = ['approval_requested', 'approval_approved', 'approval_rejected', 'system'];

/** A single notification row with per-row read/delete actions. */
function NotificationRow({ notification, onChanged }) {
  const readMutation = useMutation({
    mutationFn: () => markNotificationRead(notification.id),
    onSuccess: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteNotification(notification.id),
    onSuccess: onChanged,
  });

  const unread = !notification.readAt;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border p-4',
        unread && 'bg-secondary/40'
      )}
    >
      {/* Unread dot */}
      <span
        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>
            {notification.title}
          </span>
          <Badge variant={TYPE_BADGE[notification.type] ?? 'default'}>
            {TYPE_LABEL[notification.type] ?? notification.type}
          </Badge>
          <span className="text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</span>
        </div>
        {notification.body ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{notification.body}</p>
        ) : null}
        {notification.link ? (
          <Link to={notification.link} className="text-sm font-medium text-primary hover:underline">
            Open
          </Link>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {unread ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Mark read"
            disabled={readMutation.isPending}
            onClick={() => readMutation.mutate()}
          >
            {readMutation.isPending ? <Spinner /> : <Check className="h-4 w-4" />}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Delete notification"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { filters, setFilter, params, nextPage, prevPage } = useListQuery({
    filters: { status: '', type: '' },
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => listNotifications(params),
    placeholderData: keepPreviousData,
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const meta = notificationsQuery.data?.meta;

  // Refresh both the list and the header's unread badge after any change.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Updates about your documents and approvals. Open one to jump to the item.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={markAllMutation.isPending}
                onClick={() => markAllMutation.mutate()}
              >
                {markAllMutation.isPending ? <Spinner /> : <CheckCheck className="h-4 w-4" />}
                Mark all read
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                className="sm:w-40"
                aria-label="Filter by read status"
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Select
                className="sm:w-52"
                aria-label="Filter by type"
                value={filters.type}
                onChange={(e) => setFilter('type', e.target.value)}
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t] ?? t}
                  </option>
                ))}
              </Select>
            </div>

            {/* List states */}
            {notificationsQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading notifications" />
              </div>
            ) : notificationsQuery.isError ? (
              <Alert>{getApiError(notificationsQuery.error).message}</Alert>
            ) : notifications.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                You&rsquo;re all caught up — no notifications match these filters.
              </p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <NotificationRow key={n.id} notification={n} onChanged={invalidate} />
                ))}
              </div>
            )}

            {/* Pagination */}
            <Pagination
              meta={meta}
              busy={notificationsQuery.isFetching}
              onPrev={prevPage}
              onNext={nextPage}
              noun="notification"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
