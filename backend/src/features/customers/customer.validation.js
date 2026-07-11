/**
 * Zod schemas for the customer endpoints (Module 4).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import {
  CUSTOMER_TYPE_VALUES,
  CUSTOMER_STATUS_VALUES,
  ADDRESS_TYPE_VALUES,
} from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const customerIdParamSchema = z.object({ id: objectId('customer id') }).strict();

export const contactParamSchema = z
  .object({ id: objectId('customer id'), contactId: objectId('contact id') })
  .strict();

export const addressParamSchema = z
  .object({ id: objectId('customer id'), addressId: objectId('address id') })
  .strict();

// --- Shared field builders --------------------------------------------------

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254)
  .nullish();

const shortText = (max) => z.string().trim().max(max);

// --- Contacts ---------------------------------------------------------------

export const createContactSchema = z
  .object({
    name: z.string({ required_error: 'Contact name is required' }).trim().min(1, 'Contact name is required').max(120),
    title: shortText(120).nullish(),
    email: optionalEmail,
    phone: shortText(40).nullish(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const updateContactSchema = z
  .object({
    name: z.string().trim().min(1, 'Contact name is required').max(120).optional(),
    title: shortText(120).nullish(),
    email: optionalEmail,
    phone: shortText(40).nullish(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

// --- Addresses --------------------------------------------------------------

export const createAddressSchema = z
  .object({
    type: z.enum(ADDRESS_TYPE_VALUES).optional(),
    line1: z.string({ required_error: 'Address line 1 is required' }).trim().min(1, 'Address line 1 is required').max(200),
    line2: shortText(200).nullish(),
    city: shortText(120).nullish(),
    state: shortText(120).nullish(),
    postalCode: shortText(40).nullish(),
    country: shortText(120).nullish(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const updateAddressSchema = z
  .object({
    type: z.enum(ADDRESS_TYPE_VALUES).optional(),
    line1: z.string().trim().min(1, 'Address line 1 is required').max(200).optional(),
    line2: shortText(200).nullish(),
    city: shortText(120).nullish(),
    state: shortText(120).nullish(),
    postalCode: shortText(40).nullish(),
    country: shortText(120).nullish(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

// --- Customers --------------------------------------------------------------

const tags = z.array(z.string().trim().min(1).max(40)).max(50).optional();

export const createCustomerSchema = z
  .object({
    name: z.string({ required_error: 'Customer name is required' }).trim().min(1, 'Customer name is required').max(200),
    type: z.enum(CUSTOMER_TYPE_VALUES).optional(),
    status: z.enum(CUSTOMER_STATUS_VALUES).optional(),
    email: optionalEmail,
    phone: shortText(40).nullish(),
    website: shortText(200).nullish(),
    taxId: shortText(60).nullish(),
    notes: shortText(2000).nullish(),
    tags,
    // Contacts/addresses may be seeded at create time, or managed later via the
    // dedicated sub-resource endpoints.
    contacts: z.array(createContactSchema).max(50).optional(),
    addresses: z.array(createAddressSchema).max(50).optional(),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1, 'Customer name is required').max(200).optional(),
    type: z.enum(CUSTOMER_TYPE_VALUES).optional(),
    status: z.enum(CUSTOMER_STATUS_VALUES).optional(),
    email: optionalEmail,
    phone: shortText(40).nullish(),
    website: shortText(200).nullish(),
    taxId: shortText(60).nullish(),
    notes: shortText(2000).nullish(),
    tags,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

// Free-text search across name + email + phone (case-insensitive).
export const listCustomersQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt', 'name', '-name', 'status', '-status']),
  type: z.enum(CUSTOMER_TYPE_VALUES).optional(),
  status: z.enum(CUSTOMER_STATUS_VALUES).optional(),
});
