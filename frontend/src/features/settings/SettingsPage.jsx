import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import {
  accountSettingsSchema,
  changePasswordSchema,
  orgSettingsSchema,
} from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import {
  getMySettings,
  updateMySettings,
  changeMyPassword,
  getOrgSettings,
  updateOrgSettings,
} from './settings.api';
import {
  THEME_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  applyThemePreference,
} from './settings.helpers';

/** A labelled checkbox row (no checkbox primitive in the design system yet). */
function CheckboxField({ id, label, hint, register }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 rounded-md border border-border p-3">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
        {...register}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Account profile + presentation/notification preferences. */
function AccountCard() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings', 'me'], queryFn: getMySettings });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      theme: 'system',
      dateFormat: 'MMM D, YYYY',
      timezone: 'UTC',
      notifyEmail: true,
      notifyApprovals: true,
    },
  });

  const seed = (user) =>
    reset({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      theme: user.preferences?.theme ?? 'system',
      dateFormat: user.preferences?.dateFormat ?? 'MMM D, YYYY',
      timezone: user.preferences?.timezone ?? 'UTC',
      notifyEmail: user.preferences?.notifications?.email ?? true,
      notifyApprovals: user.preferences?.notifications?.approvals ?? true,
    });

  useEffect(() => {
    if (query.data) seed(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateMySettings({
        firstName: values.firstName,
        lastName: values.lastName,
        preferences: {
          theme: values.theme,
          dateFormat: values.dateFormat,
          timezone: values.timezone.trim(),
          notifications: { email: values.notifyEmail, approvals: values.notifyApprovals },
        },
      }),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(['settings', 'me'], user);
      seed(user);
      applyThemePreference(user.preferences?.theme ?? 'system'); // reflect the chosen theme immediately
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account &amp; preferences</CardTitle>
        <CardDescription>Your profile and how DocFlow AI looks and notifies you.</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="grid place-items-center py-16">
            <Spinner className="h-6 w-6 text-muted-foreground" label="Loading settings" />
          </div>
        ) : query.isError ? (
          <Alert>{getApiError(query.error).message}</Alert>
        ) : (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
            {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
            {mutation.isSuccess && !isDirty ? <Alert variant="success">Settings saved.</Alert> : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="firstName" label="First name" error={errors.firstName?.message}>
                <Input id="firstName" invalid={!!errors.firstName} {...register('firstName')} />
              </FormField>
              <FormField id="lastName" label="Last name" error={errors.lastName?.message}>
                <Input id="lastName" invalid={!!errors.lastName} {...register('lastName')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField id="theme" label="Theme" error={errors.theme?.message}>
                <Select id="theme" invalid={!!errors.theme} {...register('theme')}>
                  {THEME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="dateFormat" label="Date format" error={errors.dateFormat?.message}>
                <Select id="dateFormat" invalid={!!errors.dateFormat} {...register('dateFormat')}>
                  {DATE_FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="timezone" label="Timezone" error={errors.timezone?.message}>
                <Input id="timezone" placeholder="UTC" invalid={!!errors.timezone} {...register('timezone')} />
              </FormField>
            </div>

            <div className="space-y-2">
              <CheckboxField
                id="notifyEmail"
                label="Email notifications"
                hint="Receive email copies of your in-app notifications."
                register={register('notifyEmail')}
              />
              <CheckboxField
                id="notifyApprovals"
                label="Approval activity"
                hint="Notify me about approval requests and decisions."
                register={register('notifyApprovals')}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending || !isDirty}>
                {mutation.isPending ? <Spinner /> : null}
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** Change own password. On success the session is revoked → log out. */
function PasswordCard() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      changeMyPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: async () => {
      // The backend revoked all sessions; drop the local session and re-login.
      await logout();
      navigate('/login', { replace: true });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Changing your password signs you out of all sessions — you&apos;ll log in again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}

          <FormField id="currentPassword" label="Current password" error={errors.currentPassword?.message}>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.currentPassword}
              {...register('currentPassword')}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="newPassword" label="New password" error={errors.newPassword?.message}>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                invalid={!!errors.newPassword}
                {...register('newPassword')}
              />
            </FormField>
            <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                invalid={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mutation.isPending ? 'Updating…' : 'Change password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Org-wide preferences (admin+). Read-only for members with only org:read. */
function OrganizationCard() {
  const can = useAuthStore((s) => s.can);
  const canEdit = can(PERMISSIONS.ORG_UPDATE);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings', 'organization'], queryFn: getOrgSettings });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(orgSettingsSchema),
    defaultValues: {
      timezone: 'UTC',
      dateFormat: 'MMM D, YYYY',
      defaultCurrency: 'USD',
      defaultDocumentType: 'other',
      primaryColor: '#4F46E5',
      accentColor: '#0EA5E9',
      approvalEmails: true,
    },
  });

  const seed = (s) =>
    reset({
      timezone: s.timezone ?? 'UTC',
      dateFormat: s.dateFormat ?? 'MMM D, YYYY',
      defaultCurrency: s.defaultCurrency ?? 'USD',
      defaultDocumentType: s.defaultDocumentType ?? 'other',
      primaryColor: s.branding?.primaryColor ?? '#4F46E5',
      accentColor: s.branding?.accentColor ?? '#0EA5E9',
      approvalEmails: s.notifications?.approvalEmails ?? true,
    });

  useEffect(() => {
    if (query.data) seed(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateOrgSettings({
        timezone: values.timezone.trim(),
        dateFormat: values.dateFormat,
        defaultCurrency: values.defaultCurrency,
        defaultDocumentType: values.defaultDocumentType,
        branding: { primaryColor: values.primaryColor, accentColor: values.accentColor },
        notifications: { approvalEmails: values.approvalEmails },
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(['settings', 'organization'], settings);
      seed(settings);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization preferences</CardTitle>
        <CardDescription>
          {canEdit
            ? 'Workspace-wide defaults applied across DocFlow AI.'
            : 'Workspace-wide defaults. Only an admin can make changes.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="grid place-items-center py-16">
            <Spinner className="h-6 w-6 text-muted-foreground" label="Loading organization preferences" />
          </div>
        ) : query.isError ? (
          <Alert>{getApiError(query.error).message}</Alert>
        ) : (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
            {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
            {mutation.isSuccess && !isDirty ? <Alert variant="success">Preferences saved.</Alert> : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="orgTimezone" label="Timezone" error={errors.timezone?.message}>
                <Input id="orgTimezone" disabled={!canEdit} invalid={!!errors.timezone} {...register('timezone')} />
              </FormField>
              <FormField id="orgDateFormat" label="Date format" error={errors.dateFormat?.message}>
                <Select id="orgDateFormat" disabled={!canEdit} invalid={!!errors.dateFormat} {...register('dateFormat')}>
                  {DATE_FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="defaultCurrency"
                label="Default currency"
                error={errors.defaultCurrency?.message}
                hint="3-letter ISO code, e.g. USD."
              >
                <Input
                  id="defaultCurrency"
                  disabled={!canEdit}
                  invalid={!!errors.defaultCurrency}
                  {...register('defaultCurrency')}
                />
              </FormField>
              <FormField
                id="defaultDocumentType"
                label="Default document type"
                error={errors.defaultDocumentType?.message}
              >
                <Select
                  id="defaultDocumentType"
                  disabled={!canEdit}
                  invalid={!!errors.defaultDocumentType}
                  {...register('defaultDocumentType')}
                >
                  {DOCUMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="primaryColor" label="Primary colour" error={errors.primaryColor?.message}>
                <Input
                  id="primaryColor"
                  disabled={!canEdit}
                  placeholder="#4F46E5"
                  invalid={!!errors.primaryColor}
                  {...register('primaryColor')}
                />
              </FormField>
              <FormField id="accentColor" label="Accent colour" error={errors.accentColor?.message}>
                <Input
                  id="accentColor"
                  disabled={!canEdit}
                  placeholder="#0EA5E9"
                  invalid={!!errors.accentColor}
                  {...register('accentColor')}
                />
              </FormField>
            </div>

            <CheckboxField
              id="approvalEmails"
              label="Approval emails"
              hint="Send email alongside in-app notifications for approval events."
              register={{ ...register('approvalEmails'), disabled: !canEdit }}
            />

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
  );
}

/** Settings hub: account/preferences, password, and (admin) org preferences. */
export default function SettingsPage() {
  const can = useAuthStore((s) => s.can);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <AccountCard />
        <PasswordCard />
        {can(PERMISSIONS.ORG_READ) ? <OrganizationCard /> : null}
      </main>
    </div>
  );
}
