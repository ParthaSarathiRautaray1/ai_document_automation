import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { organizationSchema } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { getMyOrganization, updateMyOrganization } from './organizations.api';

/** View and (with `org:update`) edit the caller's organization profile. */
export default function OrganizationSettingsPage() {
  const can = useAuthStore((s) => s.can);
  const setOrganization = useAuthStore((s) => s.setOrganization);
  const queryClient = useQueryClient();
  const canEdit = can(PERMISSIONS.ORG_UPDATE);

  const orgQuery = useQuery({ queryKey: ['organization', 'me'], queryFn: getMyOrganization });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: '', billingEmail: '', timezone: '' },
  });

  // Seed the form once the organization loads.
  useEffect(() => {
    if (orgQuery.data) {
      reset({
        name: orgQuery.data.name ?? '',
        billingEmail: orgQuery.data.billingEmail ?? '',
        timezone: orgQuery.data.settings?.timezone ?? '',
      });
    }
  }, [orgQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateMyOrganization({
        name: values.name,
        billingEmail: values.billingEmail?.trim() ? values.billingEmail.trim() : null,
        settings: { timezone: values.timezone?.trim() || 'UTC' },
      }),
    onSuccess: (organization) => {
      setOrganization(organization);
      queryClient.setQueryData(['organization', 'me'], organization);
      reset({
        name: organization.name ?? '',
        billingEmail: organization.billingEmail ?? '',
        timezone: organization.settings?.timezone ?? '',
      });
    },
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              {canEdit
                ? 'Your workspace profile and preferences.'
                : 'Your workspace profile. Only an admin can make changes.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orgQuery.isLoading ? (
              <div className="grid place-items-center py-16">
                <Spinner className="h-6 w-6 text-muted-foreground" label="Loading organization" />
              </div>
            ) : orgQuery.isError ? (
              <Alert>{getApiError(orgQuery.error).message}</Alert>
            ) : (
              <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
                {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
                {mutation.isSuccess && !isDirty ? (
                  <Alert variant="success">Organization updated.</Alert>
                ) : null}

                <FormField id="name" label="Name" error={errors.name?.message}>
                  <Input id="name" invalid={!!errors.name} disabled={!canEdit} {...register('name')} />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id="billingEmail"
                    label="Billing email"
                    error={errors.billingEmail?.message}
                    hint="Optional — where invoices are sent."
                  >
                    <Input
                      id="billingEmail"
                      type="email"
                      placeholder="billing@acme.com"
                      invalid={!!errors.billingEmail}
                      disabled={!canEdit}
                      {...register('billingEmail')}
                    />
                  </FormField>
                  <FormField id="timezone" label="Timezone" error={errors.timezone?.message}>
                    <Input
                      id="timezone"
                      placeholder="UTC"
                      invalid={!!errors.timezone}
                      disabled={!canEdit}
                      {...register('timezone')}
                    />
                  </FormField>
                </div>

                <div className="grid gap-1 pt-1 text-sm text-muted-foreground">
                  <span>
                    Handle: <span className="font-mono">{orgQuery.data.slug}</span>
                  </span>
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
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
