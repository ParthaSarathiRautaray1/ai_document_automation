import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLayout } from '@/components/AuthLayout';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { registerSchema } from '@/lib/validators';
import { getApiError } from '@/lib/api';
import { registerRequest } from '@/features/auth/auth.api';
import { useAuthStore } from '@/store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (data) => {
      setSession({ user: data.user, accessToken: data.accessToken });
      navigate('/', { replace: true });
    },
  });

  return (
    <AuthLayout
      title="Create your account"
      description="Start managing documents with DocFlow AI."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="firstName" label="First name" error={errors.firstName?.message}>
            <Input
              id="firstName"
              autoComplete="given-name"
              placeholder="Ada"
              invalid={!!errors.firstName}
              {...register('firstName')}
            />
          </FormField>
          <FormField id="lastName" label="Last name" error={errors.lastName?.message}>
            <Input
              id="lastName"
              autoComplete="family-name"
              placeholder="Lovelace"
              invalid={!!errors.lastName}
              {...register('lastName')}
            />
          </FormField>
        </div>

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

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
