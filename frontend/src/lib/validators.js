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

// --- Templates (Module 6) ---------------------------------------------------
// A single declared variable row (managed via a field array in the UI).
export const templateVariableSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .max(60)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Letters, numbers, underscores; must start with a letter'),
  label: z.string().trim().max(120).optional(),
  type: z.enum(['text', 'number', 'date', 'boolean']).optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().max(1000).optional(),
  description: z.string().trim().max(500).optional(),
});

// Create / edit a document template. Variables are validated with the field
// array above; the schema also rejects duplicate keys (mirrors the backend).
export const templateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Template name is required')
    .max(200, 'Template name must be 200 characters or fewer'),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(['invoice', 'quote', 'contract', 'proposal', 'letter', 'other']).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  content: z
    .string()
    .min(1, 'Template content is required')
    .max(50000, 'Template content is too long'),
  variables: z
    .array(templateVariableSchema)
    .max(100)
    .superRefine((list, ctx) => {
      const seen = new Set();
      list.forEach((variable, index) => {
        if (variable.key && seen.has(variable.key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate key "${variable.key}"`,
            path: [index, 'key'],
          });
        }
        seen.add(variable.key);
      });
    })
    .optional(),
});

// --- Documents (Module 7) ---------------------------------------------------
// Edit a generated document's editable fields (the rendered content can be
// hand-tweaked). Generation itself is driven by a template + values, not this.
export const documentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Document title is required')
    .max(200, 'Document title must be 200 characters or fewer'),
  type: z.enum(['invoice', 'quote', 'contract', 'proposal', 'letter', 'other']).optional(),
  status: z.enum(['draft', 'final', 'archived']).optional(),
  content: z
    .string()
    .min(1, 'Document content is required')
    .max(200000, 'Document content is too long'),
});

// --- Email delivery (Module 9) ----------------------------------------------
// Deliver a document by email. The recipient is optional — when blank the
// backend resolves it from the linked customer.
export const sendDocumentSchema = z.object({
  to: optionalEmail,
  message: z.string().trim().max(2000).optional(),
  attachPdf: z.boolean().optional(),
});

// --- Approval workflow (Module 11) ------------------------------------------
// Route a document for approval: at least one approver, a policy, optional note.
export const requestApprovalSchema = z.object({
  approverIds: z.array(z.string()).min(1, 'Select at least one approver').max(20),
  policy: z.enum(['all', 'any']).optional(),
  note: z.string().trim().max(2000).optional(),
});

// --- Settings (Module 17) ---------------------------------------------------
// Own account: profile name + presentation/notification preferences.
export const accountSettingsSchema = z.object({
  firstName: name('First name'),
  lastName: name('Last name'),
  theme: z.enum(['light', 'dark', 'system']),
  dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM D, YYYY']),
  timezone: z.string().trim().min(1, 'Timezone is required').max(64),
  notifyEmail: z.boolean(),
  notifyApprovals: z.boolean(),
});

// Change own password. `newPassword` follows the same policy as registration;
// `confirmPassword` must match.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current one',
  });

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4F46E5');

// Org-wide preferences (admin+). Org identity (name/billing) lives on the
// Organization settings page, not here.
export const orgSettingsSchema = z.object({
  timezone: z.string().trim().min(1, 'Timezone is required').max(64),
  dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM D, YYYY']),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, 'Use a 3-letter ISO code'),
  defaultDocumentType: z.enum(['invoice', 'quote', 'contract', 'proposal', 'letter', 'other']),
  primaryColor: hexColor,
  accentColor: hexColor,
  approvalEmails: z.boolean(),
});
