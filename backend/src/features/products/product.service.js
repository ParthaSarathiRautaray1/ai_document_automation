/**
 * Product service (Module 5). Pure business logic (no req/res).
 *
 * Every operation is confined to the actor's organization (tenant isolation):
 * a catalog item in another org is reported as "not found", never leaked. SKU
 * uniqueness is enforced per organization by a partial unique index; a clash
 * surfaces as a 409 DUPLICATE_KEY via the global error handler.
 */
import Product from './product.model.js';
import ApiError from '../../utils/ApiError.js';
import { ROLES } from '../../config/constants.js';

/** Escape user input before using it in a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tenant-isolation filter. Confines every product query to the actor's own
 * organization. `super_admin` is a global role and operates across all tenants.
 * @param {{ role: string, organization: import('mongoose').Types.ObjectId | null }} actor
 * @returns {object}
 */
function orgScope(actor) {
  if (actor.role === ROLES.SUPER_ADMIN) return {};
  return { organization: actor.organization ?? null };
}

/** Require the actor to belong to an organization (catalog items are org-scoped). */
function requireOrganization(actor) {
  if (!actor.organization) {
    throw ApiError.badRequest('You must belong to an organization to manage the catalog', {
      code: 'NO_ORGANIZATION',
    });
  }
}

/**
 * Load a product document scoped to the actor's org, or throw 404. Shared by
 * every read/mutation path so isolation is enforced in one place.
 * @returns {Promise<import('mongoose').Document>}
 */
async function loadProduct(actor, id) {
  const product = await Product.findOne({ _id: id, ...orgScope(actor) });
  if (!product) {
    throw ApiError.notFound('Product not found', { code: 'PRODUCT_NOT_FOUND' });
  }
  return product;
}

/**
 * List catalog items with pagination, optional filtering (type/status/category)
 * and free-text search across name + sku + category. Scoped to the actor's org.
 * @param {object} actor
 * @param {{ page:number, limit:number, sort:string, q?:string, type?:string, status?:string, category?:string }} query
 */
export async function listProducts(actor, { page, limit, sort, q, type, status, category }) {
  const filter = { ...orgScope(actor) };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (q) {
    const rx = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { category: rx }];
  }

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  return {
    products: docs.map((doc) => doc.toJSON()),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** A single catalog item by id, scoped to the actor's org. */
export async function getProductById(actor, id) {
  const product = await loadProduct(actor, id);
  return product.toJSON();
}

/**
 * Create a catalog item in the actor's organization.
 * @param {object} actor
 * @param {object} data - validated create payload
 */
export async function createProduct(actor, data) {
  requireOrganization(actor);

  const product = new Product({
    ...data,
    organization: actor.organization,
    createdBy: actor.id,
  });

  await product.save();
  return product.toJSON();
}

/** Update catalog item fields, scoped to the actor's org. */
export async function updateProduct(actor, id, updates) {
  const product = await loadProduct(actor, id);
  Object.assign(product, updates);
  await product.save();
  return product.toJSON();
}

/** Permanently delete a catalog item. */
export async function deleteProduct(actor, id) {
  const product = await loadProduct(actor, id);
  await product.deleteOne();
}
