/**
 * Customer service (Module 4). Pure business logic (no req/res).
 *
 * Every operation is confined to the actor's organization (tenant isolation):
 * a customer in another org is reported as "not found", never leaked. Contacts
 * and addresses are embedded subdocuments managed through the parent customer.
 */
import Customer from './customer.model.js';
import ApiError from '../../utils/ApiError.js';
import { orgScope, requireOrganization, listResources } from '../../utils/query.js';

/**
 * Load a customer document scoped to the actor's org, or throw 404. Shared by
 * every read/mutation path so isolation is enforced in one place.
 * @returns {Promise<import('mongoose').Document>}
 */
async function loadCustomer(actor, id) {
  const customer = await Customer.findOne({ _id: id, ...orgScope(actor) });
  if (!customer) {
    throw ApiError.notFound('Customer not found', { code: 'CUSTOMER_NOT_FOUND' });
  }
  return customer;
}

/**
 * Load an embedded subdocument (contact/address) by id, or throw 404.
 * @param {import('mongoose').Document} customer
 * @param {'contacts'|'addresses'} field
 * @param {string} subId
 * @param {string} code - not-found error code
 */
function loadSubdoc(customer, field, subId, code) {
  const sub = customer[field].id(subId);
  if (!sub) {
    throw ApiError.notFound(`${field === 'contacts' ? 'Contact' : 'Address'} not found`, { code });
  }
  return sub;
}

/**
 * When a subdocument is marked primary, clear the flag on every sibling so at
 * most one contact/address is primary at a time.
 */
function applyPrimaryExclusivity(list, keepId) {
  list.forEach((item) => {
    if (String(item._id) !== String(keepId)) item.isPrimary = false;
  });
}

/**
 * List customers with pagination, optional filtering (type/status) and
 * free-text search across name + email + phone. Scoped to the actor's org.
 * @param {object} actor
 * @param {{ page:number, limit:number, sort:string, q?:string, type?:string, status?:string }} query
 */
export async function listCustomers(actor, { page, limit, sort, q, type, status }) {
  return listResources(Customer, 'customers', {
    actor,
    page,
    limit,
    sort,
    filters: { type, status },
    q,
    searchFields: ['name', 'email', 'phone'],
  });
}

/** A single customer by id, scoped to the actor's org. */
export async function getCustomerById(actor, id) {
  const customer = await loadCustomer(actor, id);
  return customer.toJSON();
}

/**
 * Create a customer in the actor's organization. Any seeded contacts/addresses
 * are validated by the model; primary exclusivity is applied per array.
 * @param {object} actor
 * @param {object} data - validated create payload
 */
export async function createCustomer(actor, data) {
  requireOrganization(actor, 'manage customers');

  const customer = new Customer({
    ...data,
    organization: actor.organization,
    createdBy: actor.id,
  });

  // Keep at most one primary in each seeded array (last one wins).
  for (const field of ['contacts', 'addresses']) {
    const primary = [...customer[field]].reverse().find((s) => s.isPrimary);
    if (primary) applyPrimaryExclusivity(customer[field], primary._id);
  }

  await customer.save();
  return customer.toJSON();
}

/** Update top-level customer fields (not contacts/addresses — see below). */
export async function updateCustomer(actor, id, updates) {
  const customer = await loadCustomer(actor, id);
  Object.assign(customer, updates);
  await customer.save();
  return customer.toJSON();
}

/** Permanently delete a customer (and its embedded contacts/addresses). */
export async function deleteCustomer(actor, id) {
  const customer = await loadCustomer(actor, id);
  await customer.deleteOne();
}

// --- Contacts ---------------------------------------------------------------

export async function addContact(actor, id, data) {
  const customer = await loadCustomer(actor, id);
  customer.contacts.push(data);
  const added = customer.contacts[customer.contacts.length - 1];
  if (added.isPrimary) applyPrimaryExclusivity(customer.contacts, added._id);
  await customer.save();
  return customer.toJSON();
}

export async function updateContact(actor, id, contactId, updates) {
  const customer = await loadCustomer(actor, id);
  const contact = loadSubdoc(customer, 'contacts', contactId, 'CONTACT_NOT_FOUND');
  Object.assign(contact, updates);
  if (updates.isPrimary) applyPrimaryExclusivity(customer.contacts, contact._id);
  await customer.save();
  return customer.toJSON();
}

export async function removeContact(actor, id, contactId) {
  const customer = await loadCustomer(actor, id);
  loadSubdoc(customer, 'contacts', contactId, 'CONTACT_NOT_FOUND').deleteOne();
  await customer.save();
  return customer.toJSON();
}

// --- Addresses --------------------------------------------------------------

export async function addAddress(actor, id, data) {
  const customer = await loadCustomer(actor, id);
  customer.addresses.push(data);
  const added = customer.addresses[customer.addresses.length - 1];
  if (added.isPrimary) applyPrimaryExclusivity(customer.addresses, added._id);
  await customer.save();
  return customer.toJSON();
}

export async function updateAddress(actor, id, addressId, updates) {
  const customer = await loadCustomer(actor, id);
  const address = loadSubdoc(customer, 'addresses', addressId, 'ADDRESS_NOT_FOUND');
  Object.assign(address, updates);
  if (updates.isPrimary) applyPrimaryExclusivity(customer.addresses, address._id);
  await customer.save();
  return customer.toJSON();
}

export async function removeAddress(actor, id, addressId) {
  const customer = await loadCustomer(actor, id);
  loadSubdoc(customer, 'addresses', addressId, 'ADDRESS_NOT_FOUND').deleteOne();
  await customer.save();
  return customer.toJSON();
}
