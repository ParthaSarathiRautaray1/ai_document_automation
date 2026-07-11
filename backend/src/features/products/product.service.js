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
import { orgScope, requireOrganization, listResources } from '../../utils/query.js';

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
  return listResources(Product, 'products', {
    actor,
    page,
    limit,
    sort,
    filters: { type, status, category },
    q,
    searchFields: ['name', 'sku', 'category'],
  });
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
  requireOrganization(actor, 'manage the catalog');

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
