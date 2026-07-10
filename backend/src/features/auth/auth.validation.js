/**
 * Zod validation schemas for authentication endpoints.
 * Used by the `validate` middleware. Parsing also normalizes input
 * (trims, lowercases email) before it reaches the service layer.
 */
import { z } from 'zod';

const email = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254);

/**
 * Password policy: 8–72 chars (72 is bcrypt's effective byte limit) with at
 * least one lowercase, one uppercase, and one digit. Kept strict but not
 * hostile; symbols allowed but not required.
 */
const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const name = (field) =>
  z
    .string({ required_error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`)
    .max(60, `${field} must be at most 60 characters`);

export const registerSchema = z
  .object({
    firstName: name('First name'),
    lastName: name('Last name'),
    email,
    password,
    // Self-serve org creation (Module 3): the registrant creates and owns a new
    // organization. Optional — defaults to "<First name>'s Organization".
    organizationName: z
      .string()
      .trim()
      .min(1, 'Organization name is required')
      .max(120, 'Organization name must be at most 120 characters')
      .optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    // On login we only need presence; full policy is enforced at registration.
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    // Plaintext reset token delivered by email (hex string).
    token: z
      .string({ required_error: 'Reset token is required' })
      .trim()
      .min(1, 'Reset token is required'),
    // New password must satisfy the full registration policy.
    password,
  })
  .strict();

export const acceptInviteSchema = z
  .object({
    // Plaintext invite token delivered by email (hex string).
    token: z
      .string({ required_error: 'Invitation token is required' })
      .trim()
      .min(1, 'Invitation token is required'),
    // New password must satisfy the full registration policy.
    password,
    // Optional: let the invitee correct the name the inviter entered.
    firstName: name('First name').optional(),
    lastName: name('Last name').optional(),
  })
  .strict();
