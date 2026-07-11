import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react';

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
import { templateSchema } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { deleteTemplate, getTemplate, renderTemplate, updateTemplate } from './templates.api';

const STATUS_BADGE = { draft: 'default', active: 'success', archived: 'warning' };
const TYPES = ['invoice', 'quote', 'contract', 'proposal', 'letter', 'other'];
const VARIABLE_TYPES = ['text', 'number', 'date', 'boolean'];

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/** Turn '' into undefined so we don't send empty strings for optional fields. */
const blankToUndefined = (v) => (v?.trim() ? v.trim() : undefined);

/** Build form defaults from a template record. */
function toDefaults(template) {
  return {
    name: template.name ?? '',
    type: template.type ?? 'other',
    status: template.status ?? 'draft',
    description: template.description ?? '',
    content: template.content ?? '',
    variables: (template.variables ?? []).map((v) => ({
      key: v.key ?? '',
      label: v.label ?? '',
      type: v.type ?? 'text',
      required: !!v.required,
      defaultValue: v.defaultValue ?? '',
      description: v.description ?? '',
    })),
  };
}

/** Serialize a variable row for the API (drop empty optionals → null). */
function toVariablePayload(v) {
  return {
    key: v.key.trim(),
    label: blankToUndefined(v.label) ?? null,
    type: v.type || 'text',
    required: !!v.required,
    defaultValue: v.defaultValue === '' ? null : v.defaultValue,
    description: blankToUndefined(v.description) ?? null,
  };
}

/** Core editor. Read-only fields when the user lacks template:update. */
function TemplateForm({ template, canEdit, onSaved }) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: toDefaults(template),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variables' });

  useEffect(() => {
    reset(toDefaults(template));
  }, [template, reset]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateTemplate(template.id, {
        name: values.name,
        type: values.type,
        status: values.status,
        description: blankToUndefined(values.description) ?? null,
        content: values.content,
        variables: (values.variables ?? []).map(toVariablePayload),
      }),
    onSuccess: onSaved,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          {canEdit
            ? 'Edit the body and declare the variables it uses.'
            : 'Template details. Ask a manager to make changes.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
          {mutation.isSuccess && !isDirty ? <Alert variant="success">Template updated.</Alert> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField id="name" label="Name" error={errors.name?.message}>
              <Input id="name" invalid={!!errors.name} disabled={!canEdit} {...register('name')} />
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
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>
          </div>

          <FormField id="description" label="Description" error={errors.description?.message}>
            <textarea id="description" rows={2} disabled={!canEdit} className={textareaClass} {...register('description')} />
          </FormField>

          <FormField
            id="content"
            label="Content"
            error={errors.content?.message}
            hint="Use {{variableKey}} placeholders anywhere in the body."
          >
            <textarea
              id="content"
              rows={8}
              disabled={!canEdit}
              className={`${textareaClass} font-mono`}
              {...register('content')}
            />
          </FormField>

          {/* Variables field array */}
          <div className="space-y-3 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Variables</h3>
                <p className="text-xs text-muted-foreground">
                  Declared placeholders. Optional defaults are used when a value is not supplied.
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ key: '', label: '', type: 'text', required: false, defaultValue: '', description: '' })}
                >
                  <Plus className="h-4 w-4" />
                  Add variable
                </Button>
              ) : null}
            </div>

            {fields.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No variables declared yet.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-12">
                    <div className="sm:col-span-3">
                      <FormField id={`var-key-${index}`} label="Key" error={errors.variables?.[index]?.key?.message}>
                        <Input
                          id={`var-key-${index}`}
                          className="font-mono"
                          invalid={!!errors.variables?.[index]?.key}
                          disabled={!canEdit}
                          {...register(`variables.${index}.key`)}
                        />
                      </FormField>
                    </div>
                    <div className="sm:col-span-3">
                      <FormField id={`var-label-${index}`} label="Label" error={errors.variables?.[index]?.label?.message}>
                        <Input id={`var-label-${index}`} disabled={!canEdit} {...register(`variables.${index}.label`)} />
                      </FormField>
                    </div>
                    <div className="sm:col-span-2">
                      <FormField id={`var-type-${index}`} label="Type">
                        <Select id={`var-type-${index}`} disabled={!canEdit} {...register(`variables.${index}.type`)}>
                          {VARIABLE_TYPES.map((t) => (
                            <option key={t} value={t} className="capitalize">
                              {t}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>
                    <div className="sm:col-span-3">
                      <FormField id={`var-default-${index}`} label="Default" error={errors.variables?.[index]?.defaultValue?.message}>
                        <Input id={`var-default-${index}`} disabled={!canEdit} {...register(`variables.${index}.defaultValue`)} />
                      </FormField>
                    </div>
                    <div className="flex items-end justify-between gap-2 sm:col-span-1">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" disabled={!canEdit} {...register(`variables.${index}.required`)} />
                        Req
                      </label>
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Remove variable"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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

/** Live render preview: fill declared variables and render via the API. */
function PreviewPanel({ template }) {
  const [values, setValues] = useState({});
  const variables = template.variables ?? [];

  const mutation = useMutation({ mutationFn: () => renderTemplate(template.id, values) });

  // Reset the entered values whenever the underlying template changes.
  useEffect(() => {
    setValues({});
  }, [template.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>Fill in values and render the template to preview the output.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {variables.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {variables.map((v) => (
              <FormField key={v.key} id={`preview-${v.key}`} label={`${v.label || v.key}${v.required ? ' *' : ''}`}>
                <Input
                  id={`preview-${v.key}`}
                  placeholder={v.defaultValue ?? ''}
                  value={values[v.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                />
              </FormField>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This template has no declared variables.</p>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : null}
            {mutation.isPending ? 'Rendering…' : 'Render preview'}
          </Button>
        </div>

        {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}

        {mutation.isSuccess ? (
          <div className="space-y-2">
            {mutation.data.missingRequired?.length ? (
              <Alert>
                Missing required value{mutation.data.missingRequired.length === 1 ? '' : 's'}:{' '}
                {mutation.data.missingRequired.join(', ')}
              </Alert>
            ) : null}
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 font-mono text-sm">
              {mutation.data.content}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function TemplateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();

  const canEdit = can(PERMISSIONS.TEMPLATE_UPDATE);
  const canDelete = can(PERMISSIONS.TEMPLATE_DELETE);

  const templateQuery = useQuery({ queryKey: ['template', id], queryFn: () => getTemplate(id) });

  const onSaved = (template) => {
    queryClient.setQueryData(['template', id], template);
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      navigate('/templates');
    },
  });

  if (templateQuery.isLoading) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <div className="grid flex-1 place-items-center">
          <Spinner className="h-6 w-6 text-muted-foreground" label="Loading template" />
        </div>
      </div>
    );
  }

  if (templateQuery.isError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <Alert>{getApiError(templateQuery.error).message}</Alert>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-4 w-4" />
            Back to templates
          </Button>
        </main>
      </div>
    );
  }

  const template = templateQuery.data;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {template.name}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={STATUS_BADGE[template.status] ?? 'default'}>{template.status}</Badge>
                <span className="capitalize">{template.type}</span>
                <span>· {template.variables?.length ?? 0} variable{(template.variables?.length ?? 0) === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          {canDelete ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${template.name}? This cannot be undone.`)) {
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

        <TemplateForm template={template} canEdit={canEdit} onSaved={onSaved} />
        <PreviewPanel template={template} />
      </main>
    </div>
  );
}
