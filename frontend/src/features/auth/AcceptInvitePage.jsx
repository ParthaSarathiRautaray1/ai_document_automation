import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AuthLayout } from '@/components/AuthLayout';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { acceptInviteSchema } from '@/lib/validators';
import { getApiError } from '@/lib/api';
import { acceptInviteRequest } from '@/features/auth/auth.api';
import { useAuthStore } from '@/store/authStore';

/**
 * Accept a member invitation: the invitee sets a password and is logged straight
 * into their organization. Mirrors ResetPasswordPage — the token comes from the
 * emailed link's `?token=`.
 */
export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) => acceptInviteRequest({ token, password: values.password }),
    onSuccess: (data) => {
      setSession({
        user: data.user,
        organization: data.organization,
        accessToken: data.accessToken,
        permissions: data.permissions,
      });
      navigate('/', { replace: true });
    },
  });

  if (!token) {
    return (
      <AuthLayout
        title="Invalid invitation link"
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Alert>This invitation link is missing or malformed. Ask your admin to resend it.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Accept your invitation"
      description="Set a password to activate your account and join your team."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}

        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          hint="At least 8 characters, with upper, lower, and a number."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Activating…' : 'Accept invitation'}
        </Button>
      </form>
    </AuthLayout>
  );
}
