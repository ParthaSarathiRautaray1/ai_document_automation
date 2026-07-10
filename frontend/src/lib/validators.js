/**
 * Client-side form schemas (Zod). These intentionally mirror the backend's auth
 * validation so users get instant feedback; the server remains the source of
 * truth and re-validates every request.
 */
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(254);

// Same policy as the API: 8–72 chars with lower, upper, and a digit.
const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[0-9]/, 'Add a number');

const name = (label) =>
  z.string().trim().min(1, `${label} is required`).max(60, `${label} must be 60 characters or fewer`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  firstName: name('First name'),
  lastName: name('Last name'),
  email,
  // Self-serve org creation (Module 3). Required in the UI so the tenant gets a
  // meaningful name; the API also accepts it optionally with a default.
  organizationName: z
    .string()
    .trim()
    .min(1, 'Organization name is required')
    .max(120, 'Organization name must be 120 characters or fewer'),
  password,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

// Accept an invitation: same password rules as reset, with confirmation.
export const acceptInviteSchema = resetPasswordSchema;

// Invite a new member (Module 3). Role is chosen from an assignable list in the UI.
export const inviteMemberSchema = z.object({
  firstName: name('First name'),
  lastName: name('Last name'),
  email,
  role: z.string().optional(),
});

// Edit organization profile/settings (Module 3).
export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Organization name is required')
    .max(120, 'Organization name must be 120 characters or fewer'),
  billingEmail: z.union([z.literal(''), email]).optional(),
  timezone: z.string().trim().max(64).optional(),
});
