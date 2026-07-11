import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';

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
import { templateSchema } from '@/lib/validators';
import { useListQuery } from '@/hooks/useListQuery';
import { useAuthStore } from '@/store/authStore';
import { createTemplate, listTemplates } from './templates.api';

const STATUS_BADGE = { draft: 'default', active: 'success', archived: 'warning' };
const TYPES = ['invoice', 'quote', 'contract', 'proposal', 'letter', 'other'];

/** Collapsible "new template" form (shown to users with template:create). */
function NewTemplatePanel({ onCreated }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: '', type: 'other', content: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      createTemplate({
        name: values.name,
        type: values.type || undefined,
        content: values.content,
      }),
    onSuccess: (template) => {
      reset();
      setOpen(false);
      onCreated(template);
    },
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New template
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
        <h3 className="text-sm font-semibold">New template</h3>
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
            {TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        id="newContent"
        label="Content"
        error={errors.content?.message}
        hint="Use {{variableName}} placeholders — define them on the detail page."
      >
        <textarea
          id="newContent"
          rows={5}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Dear {{customerName}}, ..."
          {...register('content')}
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Creating…' : 'Create template'}
        </Button>
      </div>
    </form>
  );
}

export default function TemplatesPage() {
  const can = useAuthStore((s) => s.can);
  const navigate = useNavigate();

  const { search, setSearch, filters, setFilter, params, nextPage, prevPage } = useListQuery({
    filters: { type: '', status: '' },
  });

  const canCreate = can(PERMISSIONS.TEMPLATE_CREATE);

  const templatesQuery = useQuery({
    queryKey: ['templates', params],
    queryFn: () => listTemplates(params),
    placeholderData: keepPreviousData,
  });

  const templates = templatesQuery.data?.templates ?? [];
  const meta = templatesQuery.data?.meta;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              Reusable document blueprints with variable placeholders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Search by name or description"
                aria-label="Search templates"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                className="sm:w-40"
                aria-label="Filter by type"
                value={filters.type}
                onChange={(e) => setFilter('type', e.target.value)}
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
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
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            {canCreate ? (
              <NewTemplatePanel onCreated={(template) => navigate(`/templates/${template.id}`)} />
            ) : null}

            {/* Table states */}
            {templatesQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading templates" />
              </div>
            ) : templatesQuery.isError ? (
              <Alert>{getApiError(templatesQuery.error).message}</Alert>
            ) : templates.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No templates match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/templates/${t.id}`)}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {t.name}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{t.type}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.variables?.length ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[t.status] ?? 'default'}>{t.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            <Pagination
              meta={meta}
              busy={templatesQuery.isFetching}
              onPrev={prevPage}
              onNext={nextPage}
              noun="template"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
