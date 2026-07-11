/**
 * Shared list/query utilities (Module 10).
 *
 * Every feature's "list" endpoint repeated the same building blocks: a
 * tenant-isolation filter, an escaped case-insensitive search, and a
 * paginated `find` + `countDocuments` with a `{ page, limit, total, pages }`
 * meta envelope. This module consolidates them so services stay thin and the
 * behaviour is identical everywhere.
 */
import ApiError from './ApiError.js';
import { ROLES } from '../config/constants.js';

/** Escape user input before using it in a RegExp (prevents invalid/abusive patterns). */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tenant-isolation filter. Confines a query to the actor's own organization so a
 * user in one org can never see or touch data in another. `super_admin` is a
 * global/out-of-band role and operates across all tenants.
 * @param {{ role: string, organization?: import('mongoose').Types.ObjectId | null }} actor
 * @returns {object} a Mongo filter fragment (`{}` for super_admin)
 */
export function orgScope(actor) {
  if (actor.role === ROLES.SUPER_ADMIN) return {};
  return { organization: actor.organization ?? null };
}

/**
 * Require the actor to belong to an organization (org-scoped resources cannot be
 * created without one). Throws 400 NO_ORGANIZATION otherwise.
 * @param {object} actor
 * @param {string} [action] - completes "You must belong to an organization to <action>"
 */
export function requireOrganization(actor, action = 'do this') {
  if (!actor.organization) {
    throw ApiError.badRequest(`You must belong to an organization to ${action}`, {
      code: 'NO_ORGANIZATION',
    });
  }
}

/**
 * Build a `$or` regex-search fragment over the given fields for a free-text
 * query, or `{}` when there is nothing to search. The query is escaped so user
 * input is always treated literally (case-insensitive).
 * @param {string|undefined|null} q
 * @param {string[]} fields
 * @returns {object}
 */
export function searchFilter(q, fields) {
  if (!q || !fields?.length) return {};
  const rx = new RegExp(escapeRegExp(q), 'i');
  return { $or: fields.map((field) => ({ [field]: rx })) };
}

/**
 * Drop `undefined` values from a filter fragment so callers can pass optional
 * filters inline (e.g. `{ type, status }`) without leaking `undefined` into the
 * Mongo query. `null` is preserved (it can be a meaningful filter value).
 * @param {Record<string, unknown>} filters
 * @returns {object}
 */
export function definedFilters(filters = {}) {
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Standard pagination meta for a list response.
 * @param {{ page:number, limit:number, total:number }} args
 * @returns {{ page:number, limit:number, total:number, pages:number }}
 */
export function paginationMeta({ page, limit, total }) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Run a paginated, tenant-scoped list query against a Mongoose model.
 *
 * Assembles the final filter from the actor's org scope, any exact-match
 * `filters` (undefined values dropped), and a free-text `search` across the
 * given fields; then fetches one page (sorted) alongside the total count.
 *
 * @param {import('mongoose').Model} Model
 * @param {object} options
 * @param {object} options.actor - the authenticated user (for org scoping)
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string} options.sort - Mongoose sort string (e.g. '-createdAt')
 * @param {Record<string, unknown>} [options.filters] - exact-match filters (undefined dropped)
 * @param {string} [options.q] - free-text search value
 * @param {string[]} [options.searchFields] - fields the search spans
 * @returns {Promise<{ docs: import('mongoose').Document[], meta: object }>}
 */
export async function paginate(
  Model,
  { actor, page, limit, sort, filters = {}, q, searchFields = [] }
) {
  const filter = {
    ...orgScope(actor),
    ...definedFilters(filters),
    ...searchFilter(q, searchFields),
  };

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit),
    Model.countDocuments(filter),
  ]);

  return { docs, meta: paginationMeta({ page, limit, total }) };
}

/**
 * Convenience wrapper around {@link paginate} that also serializes the page to
 * JSON under a named key, matching every list service's return shape:
 * `{ [key]: docs.map(d => d.toJSON()), meta }`.
 * @param {import('mongoose').Model} Model
 * @param {string} key - collection key in the result (e.g. 'products')
 * @param {object} options - see {@link paginate}
 */
export async function listResources(Model, key, options) {
  const { docs, meta } = await paginate(Model, options);
  return { [key]: docs.map((doc) => doc.toJSON()), meta };
}
