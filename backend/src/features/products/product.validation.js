/**
 * Zod schemas for the catalog endpoints (Module 5).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import { PRODUCT_TYPE_VALUES, PRODUCT_STATUS_VALUES } from '../../config/constants.js';

/** 24-char hex Mongo ObjectId. */
const objectId = (label = 'id') => z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);

export const productIdParamSchema = z.object({ id: objectId('product id') }).strict();

// --- Shared field builders --------------------------------------------------

const shortText = (max) => z.string().trim().max(max);

// A 3-letter ISO currency code, upper-cased (e.g. USD, EUR).
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter code');

const price = z.coerce.number().min(0, 'Price cannot be negative').max(1_000_000_000);
const cost = z.coerce.number().min(0, 'Cost cannot be negative').max(1_000_000_000);
const taxRate = z.coerce.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100');
const tags = z.array(z.string().trim().min(1).max(40)).max(50).optional();

// --- Products ---------------------------------------------------------------

export const createProductSchema = z
  .object({
    name: z.string({ required_error: 'Product name is required' }).trim().min(1, 'Product name is required').max(200),
    sku: shortText(60).nullish(),
    type: z.enum(PRODUCT_TYPE_VALUES).optional(),
    status: z.enum(PRODUCT_STATUS_VALUES).optional(),
    description: shortText(2000).nullish(),
    price: price.optional(),
    currency: currency.optional(),
    cost: cost.nullish(),
    taxRate: taxRate.optional(),
    unit: shortText(40).nullish(),
    category: shortText(120).nullish(),
    tags,
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Product name is required').max(200).optional(),
    sku: shortText(60).nullish(),
    type: z.enum(PRODUCT_TYPE_VALUES).optional(),
    status: z.enum(PRODUCT_STATUS_VALUES).optional(),
    description: shortText(2000).nullish(),
    price: price.optional(),
    currency: currency.optional(),
    cost: cost.nullish(),
    taxRate: taxRate.optional(),
    unit: shortText(40).nullish(),
    category: shortText(120).nullish(),
    tags,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

export const listProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort: z
      .enum(['-createdAt', 'createdAt', 'name', '-name', 'price', '-price', 'status', '-status'])
      .default('-createdAt'),
    // Free-text search across name + sku + category (case-insensitive).
    q: z.string().trim().min(1).max(120).optional(),
    type: z.enum(PRODUCT_TYPE_VALUES).optional(),
    status: z.enum(PRODUCT_STATUS_VALUES).optional(),
    category: z.string().trim().min(1).max(120).optional(),
  })
  .strict();
