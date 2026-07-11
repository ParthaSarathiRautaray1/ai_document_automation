import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, RefreshCw, Trash2 } from 'lucide-react';

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
import { documentSchema } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import {
  deleteDocument,
  downloadDocumentPdf,
  getDocument,
  regenerateDocument,
  updateDocument,
} from './documents.api';

const STATUS_BADGE = { draft: 'default', final: 'success', archived: 'warning' };
const TYPES = ['invoice', 'quote', 'contract', 'proposal', 'letter', 'other'];

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/** Build form defaults from a document record. */
function toDefaults(document) {
  return {
    title: document.title ?? '',
    type: document.type ?? 'other',
    status: document.status ?? 'draft',
    content: document.content ?? '',
  };
}

/** Core editor. Read-only fields when the user lacks document:update. */
function DocumentForm({ document, canEdit, onSaved }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(documentSchema),
    defaultValues: toDefaults(document),
  });

  useEffect(() => {
    reset(toDefaults(document));
  }, [document, reset]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateDocument(document.id, {
        title: values.title,
        type: values.type,
        status: values.status,
        content: values.content,
      }),
    onSuccess: onSaved,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          {canEdit
            ? 'Edit the metadata and the rendered content (manual tweaks are kept).'
            : 'Document details. Ask a manager to make changes.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
          {mutation.isSuccess && !isDirty ? <Alert variant="success">Document updated.</Alert> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField id="title" label="Title" error={errors.title?.message}>
              <Input id="title" invalid={!!errors.title} disabled={!canEdit} {...register('title')} />
            </FormField>
            <FormField id="type" label="Type" error={errors.type?.message}>
              <Select id="type" disabled={!canEdit} {...register('type')}>
                {TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="status" label="Status" error={errors.status?.message}>
              <Select id="status" disabled={!canEdit} {...register('status')}>
                <option value="draft">Draft</option>
                <option value="final">Final</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>
          </div>

          <FormField
            id="content"
            label="Content"
            error={errors.content?.message}
            hint="The rendered output. Regenerate below to re-render from the template."
          >
            <textarea
              id="content"
              rows={12}
              disabled={!canEdit}
              className={`${textareaClass} font-mono`}
              {...register('content')}
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

/** Re-render the document from its captured template snapshot with new values. */
function RegeneratePanel({ document, onSaved }) {
  const snapshot = document.templateSnapshot ?? {};
  const variables = snapshot.variables ?? [];
  const [values, setValues] = useState(() => ({ ...(document.values ?? {}) }));

  // Reset entered values whenever the underlying document changes.
  useEffect(() => {
    setValues({ ...(document.values ?? {}) });
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: () => regenerateDocument(document.id, values),
    onSuccess: onSaved,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regenerate</CardTitle>
        <CardDescription>
          Fill in the template variables and re-render the content. Uses the template snapshot captured
          when this document was generated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {variables.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {variables.map((v) => (
              <FormField key={v.key} id={`regen-${v.key}`} label={`${v.label || v.key}${v.required ? ' *' : ''}`}>
                <Input
                  id={`regen-${v.key}`}
                  placeholder={v.defaultValue ?? ''}
                  value={values[v.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                />
              </FormField>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This document&rsquo;s template had no declared variables.
          </p>
        )}

        {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
        {mutation.isSuccess ? <Alert variant="success">Document regenerated.</Alert> : null}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            {mutation.isPending ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();

  const canEdit = can(PERMISSIONS.DOCUMENT_UPDATE);
  const canDelete = can(PERMISSIONS.DOCUMENT_DELETE);
  const canExport = can(PERMISSIONS.DOCUMENT_EXPORT);

  const documentQuery = useQuery({ queryKey: ['document', id], queryFn: () => getDocument(id) });

  const onSaved = (document) => {
    queryClient.setQueryData(['document', id], document);
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  const exportMutation = useMutation({ mutationFn: () => downloadDocumentPdf(id) });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      navigate('/documents');
    },
  });

  if (documentQuery.isLoading) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <div className="grid flex-1 place-items-center">
          <Spinner className="h-6 w-6 text-muted-foreground" label="Loading document" />
        </div>
      </div>
    );
  }

  if (documentQuery.isError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <Alert>{getApiError(documentQuery.error).message}</Alert>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-4 w-4" />
            Back to documents
          </Button>
        </main>
      </div>
    );
  }

  const document = documentQuery.data;
  const missingRequired = document.missingRequired ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {document.title}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={STATUS_BADGE[document.status] ?? 'default'}>{document.status}</Badge>
                <span className="capitalize">{document.type}</span>
                {document.templateSnapshot?.name ? (
                  <span>· from {document.templateSnapshot.name}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canExport ? (
              <Button
                variant="outline"
                size="sm"
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate()}
              >
                {exportMutation.isPending ? <Spinner /> : <Download className="h-4 w-4" />}
                {exportMutation.isPending ? 'Preparing…' : 'Download PDF'}
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Delete ${document.title}? This cannot be undone.`)) {
                    deleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        {exportMutation.isError ? <Alert>{getApiError(exportMutation.error).message}</Alert> : null}
        {deleteMutation.isError ? <Alert>{getApiError(deleteMutation.error).message}</Alert> : null}

        {missingRequired.length > 0 ? (
          <Alert>
            Missing required value{missingRequired.length === 1 ? '' : 's'}: {missingRequired.join(', ')}
          </Alert>
        ) : null}

        <DocumentForm document={document} canEdit={canEdit} onSaved={onSaved} />
        {canEdit ? <RegeneratePanel document={document} onSaved={onSaved} /> : null}
      </main>
    </div>
  );
}
