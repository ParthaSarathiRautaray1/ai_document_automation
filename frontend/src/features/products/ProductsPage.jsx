import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Wrench } from 'lucide-react';

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
import { productSchema } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { createProduct, listProducts } from './products.api';
import { formatPrice } from './format';

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

/** Collapsible "new item" form (shown to users with product:create). */
function NewProductPanel({ onCreated }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', type: 'product', sku: '', price: '', unit: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      createProduct({
        name: values.name,
        type: values.type || undefined,
        sku: values.sku?.trim() || undefined,
        price: values.price === '' ? undefined : values.price,
        unit: values.unit?.trim() || undefined,
      }),
    onSuccess: (product) => {
      reset();
      setOpen(false);
      onCreated(product);
    },
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New item
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
        <h3 className="text-sm font-semibold">New catalog item</h3>
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
            <option value="product">Product</option>
            <option value="service">Service</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField id="newSku" label="SKU" error={errors.sku?.message}>
          <Input id="newSku" invalid={!!errors.sku} {...register('sku')} />
        </FormField>
        <FormField id="newPrice" label="Price" error={errors.price?.message}>
          <Input id="newPrice" type="number" step="0.01" min="0" invalid={!!errors.price} {...register('price')} />
        </FormField>
        <FormField id="newUnit" label="Unit" error={errors.unit?.message}>
          <Input id="newUnit" placeholder="each, hour…" {...register('unit')} />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Creating…' : 'Create item'}
        </Button>
      </div>
    </form>
  );
}

export default function ProductsPage() {
  const can = useAuthStore((s) => s.can);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const canCreate = can(PERMISSIONS.PRODUCT_CREATE);

  useEffect(() => {
    setPage(1);
  }, [q, type, status]);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, q: q || undefined, type: type || undefined, status: status || undefined }),
    [page, q, type, status]
  );

  const productsQuery = useQuery({
    queryKey: ['products', params],
    queryFn: () => listProducts(params),
    placeholderData: keepPreviousData,
  });

  const products = productsQuery.data?.products ?? [];
  const meta = productsQuery.data?.meta;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>
              The products and services your organization sells.
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
                  placeholder="Search by name, SKU, or category"
                  aria-label="Search catalog"
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
                <option value="product">Product</option>
                <option value="service">Service</option>
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
              <NewProductPanel onCreated={(product) => navigate(`/products/${product.id}`)} />
            ) : null}

            {/* Table states */}
            {productsQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading catalog" />
              </div>
            ) : productsQuery.isError ? (
              <Alert>{getApiError(productsQuery.error).message}</Alert>
            ) : products.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No items match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/products/${p.id}`)}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {p.type === 'service' ? (
                            <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                          {p.name}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{p.type}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPrice(p.price, p.currency)}
                        {p.unit ? <span className="text-xs"> / {p.unit}</span> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[p.status] ?? 'default'}>{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {meta && meta.pages > 1 ? (
              <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                <span>
                  Page {meta.page} of {meta.pages} · {meta.total} item{meta.total === 1 ? '' : 's'}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1 || productsQuery.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page >= meta.pages || productsQuery.isFetching}
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
