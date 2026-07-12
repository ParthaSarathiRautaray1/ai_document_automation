/**
 * Zod schemas for the settings endpoints (Module 17).
 */
import { z } from 'zod';
import {
  THEME_VALUES,
  DATE_FORMAT_VALUES,
  DOCUMENT_TYPE_VALUES,
} from '../../config/constants.js';

/** A 6-digit hex colour like `#4F46E5`. */
const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour like #4F46E5');

/** Per-user preference keys (all optional; merged onto the existing subdoc). */
const preferencesSchema = z
  .object({
    theme: z.enum(THEME_VALUES).optional(),
    locale: z.string().trim().min(2, 'Invalid locale').max(35).optional(),
    dateFormat: z.enum(DATE_FORMAT_VALUES).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    notifications: z
      .object({
        email: z.boolean().optional(),
        approvals: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Update own profile name and/or preferences (≥1 field required). */
export const updateMySettingsSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(60).optional(),
    lastName: z.string().trim().min(1, 'Last name is required').max(60).optional(),
    preferences: preferencesSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });

/** Change own password. New password mirrors the model's 8-char minimum. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'New password must be at least 8 characters')
      .max(128),
  })
  .strict();

/** Update org-wide preferences (≥1 field required). */
export const updateOrgSettingsSchema = z
  .object({
    timezone: z.string().trim().min(1).max(64).optional(),
    dateFormat: z.enum(DATE_FORMAT_VALUES).optional(),
    defaultCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3, 'Currency must be a 3-letter ISO code')
      .optional(),
    defaultDocumentType: z.enum(DOCUMENT_TYPE_VALUES).optional(),
    branding: z
      .object({
        primaryColor: hexColor.optional(),
        accentColor: hexColor.optional(),
      })
      .strict()
      .optional(),
    notifications: z
      .object({
        approvalEmails: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });
