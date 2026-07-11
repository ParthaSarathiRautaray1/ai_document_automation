import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addContact,
  updateContact,
  removeContact,
  addAddress,
  updateAddress,
  removeAddress,
} from '@/features/customers/customers.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listCustomers', () => {
  it('unwraps customers + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { customers: [{ id: 'c1' }] }, meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    });
    const result = await listCustomers({ page: 1, q: '', status: undefined });
    expect(api.get).toHaveBeenCalledWith('/customers', { params: { page: 1 } });
    expect(result).toEqual({ customers: [{ id: 'c1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  });
});

describe('getCustomer', () => {
  it('unwraps a single customer', async () => {
    api.get.mockResolvedValue({ data: { data: { customer: { id: 'c1', name: 'Acme' } } } });
    const customer = await getCustomer('c1');
    expect(api.get).toHaveBeenCalledWith('/customers/c1');
    expect(customer).toEqual({ id: 'c1', name: 'Acme' });
  });
});

describe('createCustomer', () => {
  it('POSTs and returns the created customer', async () => {
    api.post.mockResolvedValue({ data: { data: { customer: { id: 'c1', name: 'Acme' } } } });
    const customer = await createCustomer({ name: 'Acme' });
    expect(api.post).toHaveBeenCalledWith('/customers', { name: 'Acme' });
    expect(customer).toEqual({ id: 'c1', name: 'Acme' });
  });
});

describe('updateCustomer', () => {
  it('PATCHes by id', async () => {
    api.patch.mockResolvedValue({ data: { data: { customer: { id: 'c1', name: 'New' } } } });
    const customer = await updateCustomer('c1', { name: 'New' });
    expect(api.patch).toHaveBeenCalledWith('/customers/c1', { name: 'New' });
    expect(customer).toEqual({ id: 'c1', name: 'New' });
  });
});

describe('deleteCustomer', () => {
  it('DELETEs by id', async () => {
    api.delete.mockResolvedValue({ data: { success: true } });
    await deleteCustomer('c1');
    expect(api.delete).toHaveBeenCalledWith('/customers/c1');
  });
});

describe('contacts', () => {
  it('adds, updates, and removes a contact, returning the customer', async () => {
    api.post.mockResolvedValue({ data: { data: { customer: { id: 'c1', contacts: [{ id: 'k1' }] } } } });
    expect(await addContact('c1', { name: 'Jane' })).toEqual({ id: 'c1', contacts: [{ id: 'k1' }] });
    expect(api.post).toHaveBeenCalledWith('/customers/c1/contacts', { name: 'Jane' });

    api.patch.mockResolvedValue({ data: { data: { customer: { id: 'c1' } } } });
    await updateContact('c1', 'k1', { name: 'J' });
    expect(api.patch).toHaveBeenCalledWith('/customers/c1/contacts/k1', { name: 'J' });

    api.delete.mockResolvedValue({ data: { data: { customer: { id: 'c1', contacts: [] } } } });
    expect(await removeContact('c1', 'k1')).toEqual({ id: 'c1', contacts: [] });
    expect(api.delete).toHaveBeenCalledWith('/customers/c1/contacts/k1');
  });
});

describe('addresses', () => {
  it('adds, updates, and removes an address, returning the customer', async () => {
    api.post.mockResolvedValue({ data: { data: { customer: { id: 'c1', addresses: [{ id: 'a1' }] } } } });
    expect(await addAddress('c1', { line1: '1 Main' })).toEqual({ id: 'c1', addresses: [{ id: 'a1' }] });
    expect(api.post).toHaveBeenCalledWith('/customers/c1/addresses', { line1: '1 Main' });

    api.patch.mockResolvedValue({ data: { data: { customer: { id: 'c1' } } } });
    await updateAddress('c1', 'a1', { city: 'Metropolis' });
    expect(api.patch).toHaveBeenCalledWith('/customers/c1/addresses/a1', { city: 'Metropolis' });

    api.delete.mockResolvedValue({ data: { data: { customer: { id: 'c1', addresses: [] } } } });
    expect(await removeAddress('c1', 'a1')).toEqual({ id: 'c1', addresses: [] });
    expect(api.delete).toHaveBeenCalledWith('/customers/c1/addresses/a1');
  });
});
