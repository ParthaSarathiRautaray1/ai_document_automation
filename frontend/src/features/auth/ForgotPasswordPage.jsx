import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthLayout } from '@/components/AuthLayout';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { forgotPasswordSchema } from '@/lib/validators';
import { getApiError } from '@/lib/api';
import { forgotPasswordRequest } from '@/features/auth/auth.api';

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const mutation = useMutation({ mutationFn: forgotPasswordRequest });

  const backToSignIn = (
    <Link to="/login" className="font-medium text-primary hover:underline">
      Back to sign in
    </Link>
  );

  // The API always responds generically (never reveals whether the email
  // exists); on success we show that confirmation instead of the form.
  if (mutation.isSuccess) {
    return (
      <AuthLayout title="Check your email" footer={backToSignIn}>
        <Alert variant="success">
          {mutation.data?.message ||
            'If an account exists for that email, a password reset link is on its way.'}
        </Alert>
        <p className="mt-4 text-sm text-muted-foreground">
          The link expires shortly. If it doesn&apos;t arrive, check your spam folder or try again.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
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

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : null}
          {mutation.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
