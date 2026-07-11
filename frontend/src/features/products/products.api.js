/**
 * Product & service catalog API calls (Module 5). Each returns the unwrapped
 * payload from the backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET    /products         → { products } + meta
 *  - POST   /products         → { product }
 *  - GET    /products/:id      → { product }
 *  - PATCH  /products/:id      → { product }
 *  - DELETE /products/:id      → null
 */
import { api } from '@/lib/api';

/** Drop empty/undefined params so the strict backend query schema stays happy. */
function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

export async function listProducts(params = {}) {
  const { data } = await api.get('/products', { params: cleanParams(params) });
  return { products: data.data.products, meta: data.meta };
}

export async function getProduct(id) {
  const { data } = await api.get(`/products/${id}`);
  return data.data.product;
}

export async function createProduct(payload) {
  const { data } = await api.post('/products', payload);
  return data.data.product;
}

export async function updateProduct(id, payload) {
  const { data } = await api.patch(`/products/${id}`, payload);
  return data.data.product;
}

export async function deleteProduct(id) {
  const { data } = await api.delete(`/products/${id}`);
  return data;
}
