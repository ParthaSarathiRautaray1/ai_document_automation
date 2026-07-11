/**
 * Shared Zod validation helpers (Module 10).
 *
 * The `objectId` param check and the `page`/`limit`/`sort`/`q` list-query shape
 * were duplicated in every feature's `*.validation.js`. These builders keep the
 * pagination/search contract identical across all list endpoints.
 */
import { z } from 'zod';

/** A 24-char hex Mongo ObjectId string. */
export const objectId = (label = 'id') =>
  z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);

/** 1-based page number (coerced from the query string), defaults to 1. */
export const pageParam = z.coerce.number().int().positive().default(1);

/** Page size (coerced), capped at 100, defaults to 20. */
export const limitParam = z.coerce.number().int().positive().max(100).default(20);

/** Free-text search term (trimmed, 1–120 chars), optional. */
export const searchParam = z.string().trim().min(1).max(120).optional();

/**
 * A whitelisted `sort` param: one of `keys` (each a Mongoose sort string such as
 * `-createdAt`), defaulting to the first key. Restricting to a whitelist keeps
 * arbitrary/injected sort expressions out of the query.
 * @param {[string, ...string[]]} keys
 * @param {string} [def] - default sort (defaults to keys[0])
 */
export const sortParam = (keys, def = keys[0]) => z.enum(keys).default(def);

/**
 * Build a strict list-query schema with the standard `page`/`limit`/`q` fields
 * plus any per-resource `fields` (e.g. a `sort` whitelist and exact-match
 * filters). Coercion/normalization happens here so services get clean input.
 * @param {Record<string, z.ZodTypeAny>} [fields]
 */
export function listQuery(fields = {}) {
  return z
    .object({
      page: pageParam,
      limit: limitParam,
      q: searchParam,
      ...fields,
    })
    .strict();
}
