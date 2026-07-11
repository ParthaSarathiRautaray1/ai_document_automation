import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/features/products/products.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listProducts', () => {
  it('unwraps products + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { products: [{ id: 'p1' }] }, meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    });
    const result = await listProducts({ page: 1, q: '', type: undefined });
    expect(api.get).toHaveBeenCalledWith('/products', { params: { page: 1 } });
    expect(result).toEqual({ products: [{ id: 'p1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  });
});

describe('getProduct', () => {
  it('unwraps a single product', async () => {
    api.get.mockResolvedValue({ data: { data: { product: { id: 'p1', name: 'Widget' } } } });
    const product = await getProduct('p1');
    expect(api.get).toHaveBeenCalledWith('/products/p1');
    expect(product).toEqual({ id: 'p1', name: 'Widget' });
  });
});

describe('createProduct', () => {
  it('POSTs and returns the created product', async () => {
    api.post.mockResolvedValue({ data: { data: { product: { id: 'p1', name: 'Widget' } } } });
    const product = await createProduct({ name: 'Widget' });
    expect(api.post).toHaveBeenCalledWith('/products', { name: 'Widget' });
    expect(product).toEqual({ id: 'p1', name: 'Widget' });
  });
});

describe('updateProduct', () => {
  it('PATCHes by id', async () => {
    api.patch.mockResolvedValue({ data: { data: { product: { id: 'p1', price: 25 } } } });
    const product = await updateProduct('p1', { price: 25 });
    expect(api.patch).toHaveBeenCalledWith('/products/p1', { price: 25 });
    expect(product).toEqual({ id: 'p1', price: 25 });
  });
});

describe('deleteProduct', () => {
  it('DELETEs by id', async () => {
    api.delete.mockResolvedValue({ data: { success: true } });
    await deleteProduct('p1');
    expect(api.delete).toHaveBeenCalledWith('/products/p1');
  });
});
