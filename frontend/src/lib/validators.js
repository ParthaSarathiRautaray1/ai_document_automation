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

// --- Customers (Module 4) ---------------------------------------------------
// Optional email that also accepts an empty string (cleared field in the UI).
const optionalEmail = z.union([z.literal(''), email]).optional();

// Create / edit a customer's core profile. Contacts and addresses are managed
// separately via their own forms once the customer exists.
export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Customer name is required')
    .max(200, 'Customer name must be 200 characters or fewer'),
  type: z.enum(['business', 'individual']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  email: optionalEmail,
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// Add / edit a contact on a customer.
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required').max(120),
  title: z.string().trim().max(120).optional(),
  email: optionalEmail,
  phone: z.string().trim().max(40).optional(),
  isPrimary: z.boolean().optional(),
});

// Add / edit an address on a customer.
export const addressSchema = z.object({
  type: z.enum(['billing', 'shipping', 'other']).optional(),
  line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(40).optional(),
  country: z.string().trim().max(120).optional(),
  isPrimary: z.boolean().optional(),
});

// --- Products (Module 5) ----------------------------------------------------
// Optional non-negative money/number field that also accepts an empty string
// (a cleared input in the UI). Coerced from the text input's string value.
const optionalMoney = (label) =>
  z.union([
    z.literal(''),
    z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(0, `${label} cannot be negative`),
  ]);

// Create / edit a catalog item (product or service) with pricing + tax.
export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required')
    .max(200, 'Product name must be 200 characters or fewer'),
  sku: z.string().trim().max(60).optional(),
  type: z.enum(['product', 'service']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  description: z.string().trim().max(2000).optional(),
  price: optionalMoney('Price').optional(),
  currency: z
    .union([z.literal(''), z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')])
    .optional(),
  cost: optionalMoney('Cost').optional(),
  taxRate: z
    .union([
      z.literal(''),
      z.coerce.number({ invalid_type_error: 'Tax rate must be a number' }).min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100'),
    ])
    .optional(),
  unit: z.string().trim().max(40).optional(),
  category: z.string().trim().max(120).optional(),
});
