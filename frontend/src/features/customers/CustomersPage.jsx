import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, User } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { customerSchema } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { createCustomer, listCustomers } from './customers.api';

const PAGE_SIZE = 20;
const STATUS_BADGE = { active: 'success', inactive: 'default', archived: 'warning' };

/** Debounce a rapidly-changing value (e.g. a search box) by `delay` ms. */
function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

/** Collapsible "new customer" form (shown to users with customer:create). */
function NewCustomerPanel({ onCreated }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', type: 'business', email: '', phone: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      createCustomer({
        name: values.name,
        type: values.type || undefined,
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
      }),
    onSuccess: (customer) => {
      reset();
      setOpen(false);
      onCreated(customer);
    },
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New customer
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
        <h3 className="text-sm font-semibold">New customer</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="newName" label="Name" error={errors.name?.message}>
          <Input id="newName" invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField id="newType" label="Type" error={errors.type?.message}>
          <Select id="newType" {...register('type')}>
            <option value="business">Business</option>
            <option value="individual">Individual</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="newEmail" label="Email" error={errors.email?.message}>
          <Input id="newEmail" type="email" invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField id="newPhone" label="Phone" error={errors.phone?.message}>
          <Input id="newPhone" invalid={!!errors.phone} {...register('phone')} />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Creating…' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}

export default function CustomersPage() {
  const can = useAuthStore((s) => s.can);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const canCreate = can(PERMISSIONS.CUSTOMER_CREATE);

  useEffect(() => {
    setPage(1);
  }, [q, type, status]);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, q: q || undefined, type: type || undefined, status: status || undefined }),
    [page, q, type, status]
  );

  const customersQuery = useQuery({
    queryKey: ['customers', params],
    queryFn: () => listCustomers(params),
    placeholderData: keepPreviousData,
  });

  const customers = customersQuery.data?.customers ?? [];
  const meta = customersQuery.data?.meta;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
            <CardDescription>
              The companies and people your organization does business with.
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
                  placeholder="Search by name, email, or phone"
                  aria-label="Search customers"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                className="sm:w-40"
                aria-label="Filter by type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">All types</option>
                <option value="business">Business</option>
                <option value="individual">Individual</option>
              </Select>
              <Select
                className="sm:w-40"
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            {canCreate ? (
              <NewCustomerPanel onCreated={(customer) => navigate(`/customers/${customer.id}`)} />
            ) : null}

            {/* Table states */}
            {customersQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading customers" />
              </div>
            ) : customersQuery.isError ? (
              <Alert>{getApiError(customersQuery.error).message}</Alert>
            ) : customers.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No customers match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {c.type === 'individual' ? (
                            <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                          {c.name}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{c.type}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[c.status] ?? 'default'}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {meta && meta.pages > 1 ? (
              <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                <span>
                  Page {meta.page} of {meta.pages} · {meta.total} customer{meta.total === 1 ? '' : 's'}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1 || customersQuery.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page >= meta.pages || customersQuery.isFetching}
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
