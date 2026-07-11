/**
 * Customer CRUD (Module 4 · Tasks 2):
 *   GET/POST /customers, GET/PATCH/DELETE /customers/:id.
 * Covers the permission gates, tenant isolation, pagination/search/filter, and
 * the create/update/delete happy paths.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Customer from '../src/features/customers/customer.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, CUSTOMER_TYPE, CUSTOMER_STATUS } from '../src/config/constants.js';

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

describe('POST /customers', () => {
  it('creates a customer in the actor org (createdBy set, status default)', async () => {
    const { token, org, user } = await makeActor();
    const res = await request(app)
      .post(`${PREFIX}/customers`)
      .set(bearer(token))
      .send({ name: 'Acme Corp', email: 'hello@acme.com', type: CUSTOMER_TYPE.BUSINESS });

    expect(res.status).toBe(201);
    expect(res.body.data.customer.name).toBe('Acme Corp');
    expect(res.body.data.customer.organization).toBe(org.toString());
    expect(res.body.data.customer.createdBy).toBe(user.id);
    expect(res.body.data.customer.status).toBe(CUSTOMER_STATUS.ACTIVE);
  });

  it('seeds contacts/addresses and keeps a single primary contact', async () => {
    const { token } = await makeActor();
    const res = await request(app)
      .post(`${PREFIX}/customers`)
      .set(bearer(token))
      .send({
        name: 'Seeded',
        contacts: [
          { name: 'A', isPrimary: true },
          { name: 'B', isPrimary: true },
        ],
        addresses: [{ line1: '1 Main St' }],
      });
    expect(res.status).toBe(201);
    const primaries = res.body.data.customer.contacts.filter((c) => c.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].name).toBe('B'); // last one wins
    expect(res.body.data.customer.addresses).toHaveLength(1);
  });

  it('forbids a member without customer:create (403 FORBIDDEN_PERMISSION)', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app)
      .post(`${PREFIX}/customers`)
      .set(bearer(token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('rejects a missing name (422)', async () => {
    const { token } = await makeActor();
    const res = await request(app).post(`${PREFIX}/customers`).set(bearer(token)).send({});
    expect(res.status).toBe(422);
  });
});

describe('GET /customers', () => {
  it('lists only the actor org customers (tenant isolation), paginated', async () => {
    const { token, org } = await makeActor();
    await Customer.create([
      { organization: org, name: 'Mine One' },
      { organization: org, name: 'Mine Two' },
      { organization: new mongoose.Types.ObjectId(), name: 'Someone Else' },
    ]);

    const res = await request(app).get(`${PREFIX}/customers`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.customers).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.customers.map((c) => c.name).sort()).toEqual(['Mine One', 'Mine Two']);
  });

  it('searches by name/email and filters by status', async () => {
    const { token, org } = await makeActor();
    await Customer.create([
      { organization: org, name: 'Globex', email: 'a@globex.com', status: CUSTOMER_STATUS.ACTIVE },
      { organization: org, name: 'Initech', status: CUSTOMER_STATUS.ARCHIVED },
    ]);

    const search = await request(app).get(`${PREFIX}/customers?q=globex`).set(bearer(token));
    expect(search.body.data.customers).toHaveLength(1);
    expect(search.body.data.customers[0].name).toBe('Globex');

    const filtered = await request(app)
      .get(`${PREFIX}/customers?status=${CUSTOMER_STATUS.ARCHIVED}`)
      .set(bearer(token));
    expect(filtered.body.data.customers).toHaveLength(1);
    expect(filtered.body.data.customers[0].name).toBe('Initech');
  });

  it('allows a member to read (customer:read)', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/customers`).set(bearer(token));
    expect(res.status).toBe(200);
  });
});

describe('GET /customers/:id', () => {
  it('returns a customer in the actor org', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'Readable' });
    const res = await request(app).get(`${PREFIX}/customers/${c.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe('Readable');
  });

  it('returns 404 for a customer in another org (isolation)', async () => {
    const { token } = await makeActor();
    const other = await Customer.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign' });
    const res = await request(app).get(`${PREFIX}/customers/${other.id}`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CUSTOMER_NOT_FOUND');
  });
});

describe('PATCH /customers/:id', () => {
  it('updates top-level fields', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'Old' });
    const res = await request(app)
      .patch(`${PREFIX}/customers/${c.id}`)
      .set(bearer(token))
      .send({ name: 'New', status: CUSTOMER_STATUS.INACTIVE });
    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe('New');
    expect(res.body.data.customer.status).toBe(CUSTOMER_STATUS.INACTIVE);
  });

  it('rejects an empty update (422)', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'X' });
    const res = await request(app).patch(`${PREFIX}/customers/${c.id}`).set(bearer(token)).send({});
    expect(res.status).toBe(422);
  });

  it('forbids a member (no customer:update) with 403', async () => {
    const { org } = await makeActor();
    const member = await makeActor({ role: ROLES.MEMBER, organization: org });
    const c = await Customer.create({ organization: org, name: 'Locked' });
    const res = await request(app)
      .patch(`${PREFIX}/customers/${c.id}`)
      .set(bearer(member.token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('DELETE /customers/:id', () => {
  it('lets an admin delete a customer', async () => {
    const { token, org } = await makeActor();
    const c = await Customer.create({ organization: org, name: 'Gone' });
    const res = await request(app).delete(`${PREFIX}/customers/${c.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(await Customer.findById(c.id)).toBeNull();
  });

  it('forbids a manager (no customer:delete) with 403', async () => {
    const { token, org } = await makeActor({ role: ROLES.MANAGER });
    const c = await Customer.create({ organization: org, name: 'Safe' });
    const res = await request(app).delete(`${PREFIX}/customers/${c.id}`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('returns 404 deleting a customer in another org', async () => {
    const { token } = await makeActor();
    const other = await Customer.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign' });
    const res = await request(app).delete(`${PREFIX}/customers/${other.id}`).set(bearer(token));
    expect(res.status).toBe(404);
  });
});
