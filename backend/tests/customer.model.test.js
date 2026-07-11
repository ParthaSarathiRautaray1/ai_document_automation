/**
 * Customer model (Module 4 · Task 1): schema defaults, validation, embedded
 * contact/address subdocuments, and the JSON transform.
 */
import mongoose from 'mongoose';
import Customer from '../src/features/customers/customer.model.js';
import { CUSTOMER_TYPE, CUSTOMER_STATUS, ADDRESS_TYPE } from '../src/config/constants.js';

const orgId = () => new mongoose.Types.ObjectId();

describe('Customer model', () => {
  it('applies sensible defaults', async () => {
    const c = await Customer.create({ organization: orgId(), name: 'Acme Corp' });
    expect(c.type).toBe(CUSTOMER_TYPE.BUSINESS);
    expect(c.status).toBe(CUSTOMER_STATUS.ACTIVE);
    expect(c.contacts).toHaveLength(0);
    expect(c.addresses).toHaveLength(0);
    expect(c.tags).toEqual([]);
  });

  it('requires organization and name', async () => {
    await expect(Customer.create({ name: 'No Org' })).rejects.toThrow(/organization/i);
    await expect(Customer.create({ organization: orgId() })).rejects.toThrow(/name/i);
  });

  it('rejects an invalid email', async () => {
    await expect(
      Customer.create({ organization: orgId(), name: 'Bad', email: 'not-an-email' })
    ).rejects.toThrow(/email/i);
  });

  it('lowercases and trims email', async () => {
    const c = await Customer.create({ organization: orgId(), name: 'Case', email: '  MiXeD@Example.COM ' });
    expect(c.email).toBe('mixed@example.com');
  });

  it('embeds contacts and addresses with their own ids', async () => {
    const c = await Customer.create({
      organization: orgId(),
      name: 'With Subs',
      contacts: [{ name: 'Jane Doe', email: 'jane@acme.com', isPrimary: true }],
      addresses: [{ type: ADDRESS_TYPE.BILLING, line1: '1 Main St', city: 'Metropolis' }],
    });
    expect(c.contacts[0]._id).toBeDefined();
    expect(c.contacts[0].isPrimary).toBe(true);
    expect(c.addresses[0]._id).toBeDefined();
    expect(c.addresses[0].type).toBe(ADDRESS_TYPE.BILLING);
  });

  it('requires line1 on an address', async () => {
    await expect(
      Customer.create({ organization: orgId(), name: 'X', addresses: [{ city: 'Nowhere' }] })
    ).rejects.toThrow(/line 1/i);
  });

  it('requires a contact name', async () => {
    await expect(
      Customer.create({ organization: orgId(), name: 'X', contacts: [{ email: 'a@b.com' }] })
    ).rejects.toThrow(/contact name/i);
  });

  it('drops __v in JSON while keeping id', async () => {
    const c = await Customer.create({ organization: orgId(), name: 'Json', contacts: [{ name: 'C' }] });
    const json = c.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBeDefined();
    expect(json.contacts[0].id).toBeDefined();
    expect(json.contacts[0].__v).toBeUndefined();
  });
});
