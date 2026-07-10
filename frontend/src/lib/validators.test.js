import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validators';

describe('loginSchema', () => {
  it('accepts valid credentials and normalizes the email', () => {
    const result = loginSchema.safeParse({ email: 'ADA@Example.com', password: 'anything' });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('ada@example.com');
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });
});

describe('registerSchema password policy', () => {
  const base = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    organizationName: 'Analytical Engines',
  };

  it('accepts a strong password', () => {
    expect(registerSchema.safeParse({ ...base, password: 'Sup3rSecret' }).success).toBe(true);
  });

  it.each(['short1A', 'alllower1', 'ALLUPPER1', 'NoDigitsHere'])(
    'rejects the weak password "%s"',
    (password) => {
      expect(registerSchema.safeParse({ ...base, password }).success).toBe(false);
    }
  );

  it('requires first and last names', () => {
    expect(registerSchema.safeParse({ ...base, firstName: '', password: 'Sup3rSecret' }).success).toBe(
      false
    );
  });

  it('requires an organization name', () => {
    expect(
      registerSchema.safeParse({ ...base, organizationName: '', password: 'Sup3rSecret' }).success
    ).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching strong passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Sup3rSecret',
      confirmPassword: 'Sup3rSecret',
    });
    expect(result.success).toBe(true);
  });

  it('flags mismatched passwords on the confirm field', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Sup3rSecret',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues.some((i) => i.path.includes('confirmPassword'))).toBe(true);
  });
});
