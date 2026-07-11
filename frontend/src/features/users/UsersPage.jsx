import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2 } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Pagination } from '@/components/Pagination';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { FormField } from '@/components/ui/field';
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
import { inviteMemberSchema } from '@/lib/validators';
import {
  ROLE_VALUES,
  USER_STATUS,
  assignableRoles,
  canManageTarget,
  roleLabel,
} from '@/lib/roles';
import { useAuthStore } from '@/store/authStore';
import { inviteMember, removeMember } from '@/features/organizations/organizations.api';
import { useListQuery } from '@/hooks/useListQuery';
import { listUsers, updateUserRole, updateUserStatus } from './users.api';

const STATUS_BADGE = { active: 'success', suspended: 'destructive', invited: 'warning' };

/** Collapsible "invite a teammate" form (shown to users with org:manage_members). */
function InviteMemberPanel({ roleOptions, onInvited }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { firstName: '', lastName: '', email: '', role: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      inviteMember({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        role: values.role || undefined,
      }),
    onSuccess: () => {
      reset();
      setOpen(false);
      onInvited();
    },
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Invite member
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      className="space-y-3 rounded-md border border-border p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Invite a teammate</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="inviteFirstName" label="First name" error={errors.firstName?.message}>
          <Input id="inviteFirstName" invalid={!!errors.firstName} {...register('firstName')} />
        </FormField>
        <FormField id="inviteLastName" label="Last name" error={errors.lastName?.message}>
          <Input id="inviteLastName" invalid={!!errors.lastName} {...register('lastName')} />
        </FormField>
      </div>
      <FormField id="inviteEmail" label="Email" error={errors.email?.message}>
        <Input id="inviteEmail" type="email" invalid={!!errors.email} {...register('email')} />
      </FormField>
      <FormField id="inviteRole" label="Role" error={errors.role?.message}>
        <Select id="inviteRole" {...register('role')}>
          <option value="">Member (default)</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Sending…' : 'Send invitation'}
        </Button>
      </div>
    </form>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();

  const { search, setSearch, filters, setFilter, params, nextPage, prevPage } = useListQuery({
    filters: { role: '', status: '' },
  });

  const usersQuery = useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });

  const [actionError, setActionError] = useState(null);
  const canUpdateRole = can(PERMISSIONS.USER_UPDATE_ROLE);
  const canUpdateStatus = can(PERMISSIONS.USER_UPDATE_STATUS);
  const canManageMembers = can(PERMISSIONS.ORG_MANAGE_MEMBERS);
  const roleOptions = useMemo(() => assignableRoles(currentUser), [currentUser]);

  const onMutationError = (error) => setActionError(getApiError(error).message);
  const onMutationSuccess = () => {
    setActionError(null);
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, role: nextRole }) => updateUserRole(id, nextRole),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: nextStatus }) => updateUserStatus(id, nextStatus),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });

  const removeMutation = useMutation({
    mutationFn: ({ id }) => removeMember(id),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });

  const pendingId =
    roleMutation.isPending ? roleMutation.variables?.id
    : statusMutation.isPending ? statusMutation.variables?.id
    : removeMutation.isPending ? removeMutation.variables?.id
    : null;

  const users = usersQuery.data?.users ?? [];
  const meta = usersQuery.data?.meta;
  const hasActionsColumn = canUpdateRole || canUpdateStatus || canManageMembers;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Manage team members — search, filter, and (with permission) adjust roles and access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Search by name or email"
                aria-label="Search users"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                className="sm:w-40"
                aria-label="Filter by role"
                value={filters.role}
                onChange={(e) => setFilter('role', e.target.value)}
              >
                <option value="">All roles</option>
                {ROLE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
              <Select
                className="sm:w-40"
                aria-label="Filter by status"
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
              >
                <option value="">All statuses</option>
                <option value={USER_STATUS.ACTIVE}>Active</option>
                <option value={USER_STATUS.SUSPENDED}>Suspended</option>
                <option value={USER_STATUS.INVITED}>Invited</option>
              </Select>
            </div>

            {canManageMembers ? (
              <InviteMemberPanel roleOptions={roleOptions} onInvited={onMutationSuccess} />
            ) : null}

            {actionError ? <Alert>{actionError}</Alert> : null}

            {/* Table states */}
            {usersQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading users" />
              </div>
            ) : usersQuery.isError ? (
              <Alert>{getApiError(usersQuery.error).message}</Alert>
            ) : users.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No users match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    {hasActionsColumn ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const manageable = canManageTarget(currentUser, u);
                    const rowBusy = pendingId === u.id;
                    return (
                      <TableRow key={u.id} className={rowBusy ? 'opacity-60' : undefined}>
                        <TableCell className="font-medium">
                          {u.fullName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—'}
                          {isSelf ? (
                            <Badge variant="primary" className="ml-2">
                              You
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          {canUpdateRole && manageable ? (
                            <Select
                              className="h-9 w-36"
                              aria-label={`Change role for ${u.email}`}
                              value={u.role}
                              disabled={rowBusy}
                              onChange={(e) => {
                                if (e.target.value !== u.role) {
                                  roleMutation.mutate({ id: u.id, role: e.target.value });
                                }
                              }}
                            >
                              {roleOptions.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabel(r)}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="capitalize">{roleLabel(u.role)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[u.status] ?? 'default'}>{u.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                        {hasActionsColumn ? (
                          <TableCell className="text-right">
                            {manageable ? (
                              <div className="flex justify-end gap-2">
                                {canUpdateStatus ? (
                                  <Button
                                    variant={u.status === USER_STATUS.SUSPENDED ? 'outline' : 'destructive'}
                                    size="sm"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      statusMutation.mutate({
                                        id: u.id,
                                        status:
                                          u.status === USER_STATUS.SUSPENDED
                                            ? USER_STATUS.ACTIVE
                                            : USER_STATUS.SUSPENDED,
                                      })
                                    }
                                  >
                                    {u.status === USER_STATUS.SUSPENDED ? 'Reactivate' : 'Suspend'}
                                  </Button>
                                ) : null}
                                {canManageMembers ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={rowBusy}
                                    aria-label={`Remove ${u.email}`}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Remove ${u.fullName || u.email} from the organization? This cannot be undone.`
                                        )
                                      ) {
                                        removeMutation.mutate({ id: u.id });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            <Pagination
              meta={meta}
              busy={usersQuery.isFetching}
              onPrev={prevPage}
              onNext={nextPage}
              noun="user"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
