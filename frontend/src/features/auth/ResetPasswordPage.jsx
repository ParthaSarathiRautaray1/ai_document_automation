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
import { resetPasswordSchema } from '@/lib/validators';
import { getApiError } from '@/lib/api';
import { resetPasswordRequest } from '@/features/auth/auth.api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) => resetPasswordRequest({ token, password: values.password }),
    onSuccess: () => {
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password has been reset. Please sign in with your new password.' },
      });
    },
  });

  // A missing token means the user arrived without a valid reset link.
  if (!token) {
    return (
      <AuthLayout
        title="Invalid reset link"
        footer={
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <Alert>This password reset link is missing or malformed. Request a new one to continue.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      description="Choose a strong password you don't use elsewhere."
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
          label="New password"
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

        <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
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
          {mutation.isPending ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
