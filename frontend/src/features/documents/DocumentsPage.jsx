import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Sparkles } from 'lucide-react';

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
import { useListQuery } from '@/hooks/useListQuery';
import { useAuthStore } from '@/store/authStore';
import { listTemplates, getTemplate } from '@/features/templates/templates.api';
import { generateDocument, listDocuments } from './documents.api';

const STATUS_BADGE = { draft: 'default', final: 'success', archived: 'warning' };
const TYPES = ['invoice', 'quote', 'contract', 'proposal', 'letter', 'other'];

/**
 * Collapsible "generate document" form (shown to users with document:create).
 * Pick a template, optionally override the title, fill declared variable values,
 * then generate — the backend renders + persists the result.
 */
function GenerateDocumentPanel({ onGenerated }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [values, setValues] = useState({});

  // A generous page of templates to choose from (name + variables live on detail).
  const templatesQuery = useQuery({
    queryKey: ['templates', { forGenerate: true }],
    queryFn: () => listTemplates({ limit: 100, sort: 'name' }),
    enabled: open,
  });

  // Full template (with variables) for the chosen id.
  const templateQuery = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => getTemplate(templateId),
    enabled: open && !!templateId,
  });

  const template = templateQuery.data;
  const variables = template?.variables ?? [];

  // Reset entered values whenever the selected template changes.
  useEffect(() => {
    setValues({});
  }, [templateId]);

  const mutation = useMutation({
    mutationFn: () =>
      generateDocument({
        templateId,
        title: title.trim() || undefined,
        values,
      }),
    onSuccess: (document) => {
      setOpen(false);
      setTemplateId('');
      setTitle('');
      setValues({});
      onGenerated(document);
    },
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Sparkles className="h-4 w-4" />
          Generate document
        </Button>
      </div>
    );
  }

  const templates = templatesQuery.data?.templates ?? [];

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Generate document</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="gen-template" label="Template">
          {templatesQuery.isLoading ? (
            <div className="flex h-9 items-center">
              <Spinner className="h-4 w-4 text-muted-foreground" label="Loading templates" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet. Create one first.</p>
          ) : (
            <Select id="gen-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="gen-title" label="Title" hint="Defaults to the template name.">
          <Input
            id="gen-title"
            placeholder={template?.name ?? ''}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
      </div>

      {templateId && templateQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> Loading template…
        </div>
      ) : null}

      {template && variables.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {variables.map((v) => (
            <FormField
              key={v.key}
              id={`gen-${v.key}`}
              label={`${v.label || v.key}${v.required ? ' *' : ''}`}
            >
              <Input
                id={`gen-${v.key}`}
                placeholder={v.defaultValue ?? ''}
                value={values[v.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
              />
            </FormField>
          ))}
        </div>
      ) : null}

      {template && variables.length === 0 ? (
        <p className="text-sm text-muted-foreground">This template has no declared variables.</p>
      ) : null}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={!templateId || mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Generating…' : 'Generate'}
        </Button>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const can = useAuthStore((s) => s.can);
  const navigate = useNavigate();

  const { search, setSearch, filters, setFilter, params, nextPage, prevPage } = useListQuery({
    filters: { type: '', status: '' },
  });

  const canCreate = can(PERMISSIONS.DOCUMENT_CREATE);

  const documentsQuery = useQuery({
    queryKey: ['documents', params],
    queryFn: () => listDocuments(params),
    placeholderData: keepPreviousData,
  });

  const documents = documentsQuery.data?.documents ?? [];
  const meta = documentsQuery.data?.meta;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Documents generated from your templates by filling in their variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Search by title"
                aria-label="Search documents"
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
                <option value="final">Final</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            {canCreate ? (
              <GenerateDocumentPanel onGenerated={(document) => navigate(`/documents/${document.id}`)} />
            ) : null}

            {/* Table states */}
            {documentsQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading documents" />
              </div>
            ) : documentsQuery.isError ? (
              <Alert>{getApiError(documentsQuery.error).message}</Alert>
            ) : documents.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No documents match these filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/documents/${d.id}`)}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {d.title}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{d.type}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[d.status] ?? 'default'}>{d.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            <Pagination
              meta={meta}
              busy={documentsQuery.isFetching}
              onPrev={prevPage}
              onNext={nextPage}
              noun="document"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
