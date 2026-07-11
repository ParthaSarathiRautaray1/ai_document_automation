/**
 * Customer API calls (Module 4). Each returns the unwrapped payload from the
 * backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET    /customers                              → { customers } + meta
 *  - POST   /customers                              → { customer }
 *  - GET    /customers/:id                          → { customer }
 *  - PATCH  /customers/:id                          → { customer }
 *  - DELETE /customers/:id                          → null
 *  - POST   /customers/:id/contacts                 → { customer }
 *  - PATCH  /customers/:id/contacts/:contactId      → { customer }
 *  - DELETE /customers/:id/contacts/:contactId      → { customer }
 *  - POST   /customers/:id/addresses                → { customer }
 *  - PATCH  /customers/:id/addresses/:addressId     → { customer }
 *  - DELETE /customers/:id/addresses/:addressId     → { customer }
 */
import { api } from '@/lib/api';

/** Drop empty/undefined params so the strict backend query schema stays happy. */
function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

export async function listCustomers(params = {}) {
  const { data } = await api.get('/customers', { params: cleanParams(params) });
  return { customers: data.data.customers, meta: data.meta };
}

export async function getCustomer(id) {
  const { data } = await api.get(`/customers/${id}`);
  return data.data.customer;
}

export async function createCustomer(payload) {
  const { data } = await api.post('/customers', payload);
  return data.data.customer;
}

export async function updateCustomer(id, payload) {
  const { data } = await api.patch(`/customers/${id}`, payload);
  return data.data.customer;
}

export async function deleteCustomer(id) {
  const { data } = await api.delete(`/customers/${id}`);
  return data;
}

// --- Contacts ---------------------------------------------------------------

export async function addContact(customerId, payload) {
  const { data } = await api.post(`/customers/${customerId}/contacts`, payload);
  return data.data.customer;
}

export async function updateContact(customerId, contactId, payload) {
  const { data } = await api.patch(`/customers/${customerId}/contacts/${contactId}`, payload);
  return data.data.customer;
}

export async function removeContact(customerId, contactId) {
  const { data } = await api.delete(`/customers/${customerId}/contacts/${contactId}`);
  return data.data.customer;
}

// --- Addresses --------------------------------------------------------------

export async function addAddress(customerId, payload) {
  const { data } = await api.post(`/customers/${customerId}/addresses`, payload);
  return data.data.customer;
}

export async function updateAddress(customerId, addressId, payload) {
  const { data } = await api.patch(`/customers/${customerId}/addresses/${addressId}`, payload);
  return data.data.customer;
}

export async function removeAddress(customerId, addressId) {
  const { data } = await api.delete(`/customers/${customerId}/addresses/${addressId}`);
  return data.data.customer;
}
