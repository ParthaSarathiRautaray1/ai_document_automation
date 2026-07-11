import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, Trash2, Wrench } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { productSchema } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { deleteProduct, getProduct, updateProduct } from './products.api';

const STATUS_BADGE = { active: 'success', inactive: 'default', archived: 'warning' };

/** Turn '' into undefined so we don't send empty strings for optional fields. */
const blankToUndefined = (v) => (v?.trim() ? v.trim() : undefined);

/** Build defaults for the form from a product record. */
function toDefaults(product) {
  return {
    name: product.name ?? '',
    sku: product.sku ?? '',
    type: product.type ?? 'product',
    status: product.status ?? 'active',
    description: product.description ?? '',
    price: product.price ?? 0,
    currency: product.currency ?? 'USD',
    cost: product.cost ?? '',
    taxRate: product.taxRate ?? 0,
    unit: product.unit ?? '',
    category: product.category ?? '',
  };
}

/** Core editor. Read-only fields when the user lacks product:update. */
function ProductForm({ product, canEdit, onSaved }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: toDefaults(product),
  });

  useEffect(() => {
    reset(toDefaults(product));
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateProduct(product.id, {
        name: values.name,
        sku: blankToUndefined(values.sku) ?? null,
        type: values.type,
        status: values.status,
        description: blankToUndefined(values.description) ?? null,
        price: values.price === '' ? 0 : values.price,
        currency: blankToUndefined(values.currency) || undefined,
        cost: values.cost === '' ? null : values.cost,
        taxRate: values.taxRate === '' ? 0 : values.taxRate,
        unit: blankToUndefined(values.unit) ?? null,
        category: blankToUndefined(values.category) ?? null,
      }),
    onSuccess: onSaved,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          {canEdit ? 'Pricing and catalog details for this item.' : 'Catalog details. Ask a manager to make changes.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
          {mutation.isSuccess && !isDirty ? <Alert variant="success">Item updated.</Alert> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="name" label="Name" error={errors.name?.message}>
              <Input id="name" invalid={!!errors.name} disabled={!canEdit} {...register('name')} />
            </FormField>
            <FormField id="type" label="Type" error={errors.type?.message}>
              <Select id="type" disabled={!canEdit} {...register('type')}>
                <option value="product">Product</option>
                <option value="service">Service</option>
              </Select>
            </FormField>
            <FormField id="sku" label="SKU" error={errors.sku?.message}>
              <Input id="sku" invalid={!!errors.sku} disabled={!canEdit} {...register('sku')} />
            </FormField>
            <FormField id="category" label="Category" error={errors.category?.message}>
              <Input id="category" disabled={!canEdit} {...register('category')} />
            </FormField>
            <FormField id="price" label="Price" error={errors.price?.message}>
              <Input id="price" type="number" step="0.01" min="0" invalid={!!errors.price} disabled={!canEdit} {...register('price')} />
            </FormField>
            <FormField id="currency" label="Currency" error={errors.currency?.message}>
              <Input id="currency" maxLength={3} invalid={!!errors.currency} disabled={!canEdit} {...register('currency')} />
            </FormField>
            <FormField id="cost" label="Cost" error={errors.cost?.message}>
              <Input id="cost" type="number" step="0.01" min="0" invalid={!!errors.cost} disabled={!canEdit} {...register('cost')} />
            </FormField>
            <FormField id="taxRate" label="Tax rate (%)" error={errors.taxRate?.message}>
              <Input id="taxRate" type="number" step="0.01" min="0" max="100" invalid={!!errors.taxRate} disabled={!canEdit} {...register('taxRate')} />
            </FormField>
            <FormField id="unit" label="Unit" error={errors.unit?.message}>
              <Input id="unit" placeholder="each, hour…" disabled={!canEdit} {...register('unit')} />
            </FormField>
            <FormField id="status" label="Status" error={errors.status?.message}>
              <Select id="status" disabled={!canEdit} {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>
          </div>

          <FormField id="description" label="Description" error={errors.description?.message}>
            <textarea
              id="description"
              rows={3}
              disabled={!canEdit}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register('description')}
            />
          </FormField>

          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending || !isDirty}>
                {mutation.isPending ? <Spinner /> : null}
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();

  const canEdit = can(PERMISSIONS.PRODUCT_UPDATE);
  const canDelete = can(PERMISSIONS.PRODUCT_DELETE);

  const productQuery = useQuery({ queryKey: ['product', id], queryFn: () => getProduct(id) });

  const onSaved = (product) => {
    queryClient.setQueryData(['product', id], product);
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });

  if (productQuery.isLoading) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <div className="grid flex-1 place-items-center">
          <Spinner className="h-6 w-6 text-muted-foreground" label="Loading item" />
        </div>
      </div>
    );
  }

  if (productQuery.isError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <Alert>{getApiError(productQuery.error).message}</Alert>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/products')}>
            <ArrowLeft className="h-4 w-4" />
            Back to catalog
          </Button>
        </main>
      </div>
    );
  }

  const product = productQuery.data;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/products')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                {product.type === 'service' ? (
                  <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
                {product.name}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={STATUS_BADGE[product.status] ?? 'default'}>{product.status}</Badge>
                <span className="capitalize">{product.type}</span>
                {product.sku ? <span>· {product.sku}</span> : null}
              </div>
            </div>
          </div>
          {canDelete ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${product.name}? This cannot be undone.`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>

        {deleteMutation.isError ? <Alert>{getApiError(deleteMutation.error).message}</Alert> : null}

        <ProductForm product={product} canEdit={canEdit} onSaved={onSaved} />
      </main>
    </div>
  );
}
