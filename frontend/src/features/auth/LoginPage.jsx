import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AuthLayout } from '@/components/AuthLayout';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { loginSchema } from '@/lib/validators';
import { getApiError } from '@/lib/api';
import { loginRequest } from '@/features/auth/auth.api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const redirectTo = location.state?.from?.pathname || '/';
  const notice = location.state?.notice || null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const mutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      setSession({
        user: data.user,
        organization: data.organization,
        accessToken: data.accessToken,
        permissions: data.permissions,
      });
      navigate(redirectTo, { replace: true });
    },
  });

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your DocFlow AI account."
      footer={
        <span>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        {notice ? <Alert variant="success">{notice}</Alert> : null}
        {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>

        <FormField id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
