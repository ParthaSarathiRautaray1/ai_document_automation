/**
 * Zod schemas for the organization endpoints (Module 3).
 */
import { z } from 'zod';
import { ROLE_VALUES } from '../../config/constants.js';

const name = (field) =>
  z.string({ required_error: `${field} is required` }).trim().min(1, `${field} is required`).max(60);

/** Invite a new member into the caller's organization. */
export const inviteMemberSchema = z
  .object({
    firstName: name('First name'),
    lastName: name('Last name'),
    email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Invalid email address').max(254),
    // Optional; defaults to `member` in the service. The service also enforces
    // that it ranks strictly below the inviter (no escalation).
    role: z.enum(ROLE_VALUES).optional(),
  })
  .strict();

/** At least one updatable field must be present. */
export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120).optional(),
    // `null` clears the billing email; a string must be a valid email.
    billingEmail: z.string().trim().toLowerCase().email('Invalid email address').max(254).nullable().optional(),
    settings: z
      .object({
        timezone: z.string().trim().min(1).max(64).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });
