/**
 * Customer contacts & addresses sub-resources (Module 4 · Task 3):
 *   POST/PATCH/DELETE /customers/:id/contacts[/:contactId]
 *   POST/PATCH/DELETE /customers/:id/addresses[/:addressId]
 * Covers add/update/remove, single-primary exclusivity, tenant isolation, and
 * the customer:update permission gate.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Customer from '../src/features/customers/customer.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, ADDRESS_TYPE } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeActor({ role = ROLES.ADMIN, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'Act',
    lastName: 'Or',
    email: `actor-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

describe('Customer contacts', () => {
  it('adds a contact', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'Acme' });
    const res = await request(app)
      .post(`${PREFIX}/customers/${c.id}/contacts`)
      .set(bearer(token))
      .send({ name: 'Jane Doe', email: 'jane@acme.com', title: 'CFO' });
    expect(res.status).toBe(201);
    expect(res.body.data.customer.contacts).toHaveLength(1);
    expect(res.body.data.customer.contacts[0].name).toBe('Jane Doe');
  });

  it('keeps only one primary contact across add/update', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({
      organization: org,
      name: 'Acme',
      contacts: [{ name: 'First', isPrimary: true }],
    });

    // Add a second primary → the first should be demoted.
    const added = await request(app)
      .post(`${PREFIX}/customers/${c.id}/contacts`)
      .set(bearer(token))
      .send({ name: 'Second', isPrimary: true });
    expect(added.status).toBe(201);
    let primaries = added.body.data.customer.contacts.filter((x) => x.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].name).toBe('Second');

    // Promote the first back to primary via update → the second is demoted.
    const firstId = added.body.data.customer.contacts.find((x) => x.name === 'First').id;
    const updated = await request(app)
      .patch(`${PREFIX}/customers/${c.id}/contacts/${firstId}`)
      .set(bearer(token))
      .send({ isPrimary: true });
    expect(updated.status).toBe(200);
    primaries = updated.body.data.customer.contacts.filter((x) => x.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].name).toBe('First');
  });

  it('updates and removes a contact', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({
      organization: org,
      name: 'Acme',
      contacts: [{ name: 'Old Name' }],
    });
    const contactId = c.contacts[0].id;

    const updated = await request(app)
      .patch(`${PREFIX}/customers/${c.id}/contacts/${contactId}`)
      .set(bearer(token))
      .send({ name: 'New Name' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.customer.contacts[0].name).toBe('New Name');

    const removed = await request(app)
      .delete(`${PREFIX}/customers/${c.id}/contacts/${contactId}`)
      .set(bearer(token));
    expect(removed.status).toBe(200);
    expect(removed.body.data.customer.contacts).toHaveLength(0);
  });

  it('returns 404 for an unknown contact', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'Acme' });
    const res = await request(app)
      .patch(`${PREFIX}/customers/${c.id}/contacts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(token))
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONTACT_NOT_FOUND');
  });

  it('forbids a member without customer:update (403)', async () => {
    const { org } = await makeActor();
    const member = await makeActor({ role: ROLES.MEMBER, organization: org });
    const c = await Customer.create({ organization: org, name: 'Acme' });
    const res = await request(app)
      .post(`${PREFIX}/customers/${c.id}/contacts`)
      .set(bearer(member.token))
      .send({ name: 'X' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('returns 404 adding a contact to a customer in another org (isolation)', async () => {
    const { token } = await makeActor();
    const other = await Customer.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign' });
    const res = await request(app)
      .post(`${PREFIX}/customers/${other.id}/contacts`)
      .set(bearer(token))
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CUSTOMER_NOT_FOUND');
  });
});

describe('Customer addresses', () => {
  it('adds, updates, and removes an address', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'Acme' });

    const added = await request(app)
      .post(`${PREFIX}/customers/${c.id}/addresses`)
      .set(bearer(token))
      .send({ type: ADDRESS_TYPE.BILLING, line1: '1 Main St', city: 'Metropolis', isPrimary: true });
    expect(added.status).toBe(201);
    const addressId = added.body.data.customer.addresses[0].id;
    expect(added.body.data.customer.addresses[0].type).toBe(ADDRESS_TYPE.BILLING);

    const updated = await request(app)
      .patch(`${PREFIX}/customers/${c.id}/addresses/${addressId}`)
      .set(bearer(token))
      .send({ city: 'Gotham' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.customer.addresses[0].city).toBe('Gotham');

    const removed = await request(app)
      .delete(`${PREFIX}/customers/${c.id}/addresses/${addressId}`)
      .set(bearer(token));
    expect(removed.status).toBe(200);
    expect(removed.body.data.customer.addresses).toHaveLength(0);
  });

  it('requires line1 when adding an address (422)', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'Acme' });
    const res = await request(app)
      .post(`${PREFIX}/customers/${c.id}/addresses`)
      .set(bearer(token))
      .send({ city: 'Nowhere' });
    expect(res.status).toBe(422);
  });

  it('keeps a single primary address', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({
      organization: org,
      name: 'Acme',
      addresses: [{ line1: 'A', isPrimary: true }],
    });
    const res = await request(app)
      .post(`${PREFIX}/customers/${c.id}/addresses`)
      .set(bearer(token))
      .send({ line1: 'B', isPrimary: true });
    expect(res.status).toBe(201);
    const primaries = res.body.data.customer.addresses.filter((a) => a.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].line1).toBe('B');
  });
});
