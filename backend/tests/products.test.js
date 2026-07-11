/**
 * Product & service catalog CRUD (Module 5 · Task 2):
 *   GET/POST /products, GET/PATCH/DELETE /products/:id.
 * Covers the permission gates, tenant isolation, pagination/search/filter, the
 * create/update/delete happy paths, and per-org SKU uniqueness (409).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Product from '../src/features/products/product.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, PRODUCT_TYPE, PRODUCT_STATUS } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Build the per-org unique SKU index before the duplicate-key case runs.
beforeAll(async () => {
  await Product.init();
});

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

describe('POST /products', () => {
  it('creates a product in the actor org (createdBy set, defaults applied)', async () => {
    const { token, org, user } = await makeActor();
    const res = await request(app)
      .post(`${PREFIX}/products`)
      .set(bearer(token))
      .send({ name: 'Widget', price: 19.99, sku: 'W-1' });

    expect(res.status).toBe(201);
    expect(res.body.data.product.name).toBe('Widget');
    expect(res.body.data.product.organization).toBe(org.toString());
    expect(res.body.data.product.createdBy).toBe(user.id);
    expect(res.body.data.product.status).toBe(PRODUCT_STATUS.ACTIVE);
    expect(res.body.data.product.type).toBe(PRODUCT_TYPE.PRODUCT);
    expect(res.body.data.product.price).toBe(19.99);
    expect(res.body.data.product.currency).toBe('USD');
  });

  it('creates a service with a unit and tax rate', async () => {
    const { token } = await makeActor();
    const res = await request(app)
      .post(`${PREFIX}/products`)
      .set(bearer(token))
      .send({ name: 'Consulting', type: PRODUCT_TYPE.SERVICE, price: 120, unit: 'hour', taxRate: 8.25, currency: 'eur' });
    expect(res.status).toBe(201);
    expect(res.body.data.product.type).toBe(PRODUCT_TYPE.SERVICE);
    expect(res.body.data.product.unit).toBe('hour');
    expect(res.body.data.product.taxRate).toBe(8.25);
    expect(res.body.data.product.currency).toBe('EUR');
  });

  it('rejects a duplicate SKU within the same org (409 DUPLICATE_KEY)', async () => {
    const { token, org } = await makeActor();
    await Product.create({ organization: org, name: 'First', sku: 'DUP' });
    const res = await request(app)
      .post(`${PREFIX}/products`)
      .set(bearer(token))
      .send({ name: 'Second', sku: 'DUP' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_KEY');
  });

  it('forbids a member without product:create (403 FORBIDDEN_PERMISSION)', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app)
      .post(`${PREFIX}/products`)
      .set(bearer(token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('rejects a missing name (422)', async () => {
    const { token } = await makeActor();
    const res = await request(app).post(`${PREFIX}/products`).set(bearer(token)).send({});
    expect(res.status).toBe(422);
  });

  it('rejects a negative price (422)', async () => {
    const { token } = await makeActor();
    const res = await request(app)
      .post(`${PREFIX}/products`)
      .set(bearer(token))
      .send({ name: 'Bad', price: -5 });
    expect(res.status).toBe(422);
  });
});

describe('GET /products', () => {
  it('lists only the actor org products (tenant isolation), paginated', async () => {
    const { token, org } = await makeActor();
    await Product.create([
      { organization: org, name: 'Mine One' },
      { organization: org, name: 'Mine Two' },
      { organization: new mongoose.Types.ObjectId(), name: 'Someone Else' },
    ]);

    const res = await request(app).get(`${PREFIX}/products`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.products.map((p) => p.name).sort()).toEqual(['Mine One', 'Mine Two']);
  });

  it('searches by name/sku and filters by type', async () => {
    const { token, org } = await makeActor();
    await Product.create([
      { organization: org, name: 'Blue Widget', sku: 'BW-1', type: PRODUCT_TYPE.PRODUCT },
      { organization: org, name: 'Support Plan', type: PRODUCT_TYPE.SERVICE },
    ]);

    const search = await request(app).get(`${PREFIX}/products?q=widget`).set(bearer(token));
    expect(search.body.data.products).toHaveLength(1);
    expect(search.body.data.products[0].name).toBe('Blue Widget');

    const bySku = await request(app).get(`${PREFIX}/products?q=BW-1`).set(bearer(token));
    expect(bySku.body.data.products).toHaveLength(1);

    const filtered = await request(app)
      .get(`${PREFIX}/products?type=${PRODUCT_TYPE.SERVICE}`)
      .set(bearer(token));
    expect(filtered.body.data.products).toHaveLength(1);
    expect(filtered.body.data.products[0].name).toBe('Support Plan');
  });

  it('allows a member to read (product:read)', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/products`).set(bearer(token));
    expect(res.status).toBe(200);
  });
});

describe('GET /products/:id', () => {
  it('returns a product in the actor org', async () => {
    const { token, org } = await makeActor();
    const p = await Product.create({ organization: org, name: 'Readable' });
    const res = await request(app).get(`${PREFIX}/products/${p.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.product.name).toBe('Readable');
  });

  it('returns 404 for a product in another org (isolation)', async () => {
    const { token } = await makeActor();
    const other = await Product.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign' });
    const res = await request(app).get(`${PREFIX}/products/${other.id}`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('PATCH /products/:id', () => {
  it('updates fields', async () => {
    const { token, org } = await makeActor();
    const p = await Product.create({ organization: org, name: 'Old', price: 10 });
    const res = await request(app)
      .patch(`${PREFIX}/products/${p.id}`)
      .set(bearer(token))
      .send({ name: 'New', price: 25, status: PRODUCT_STATUS.INACTIVE });
    expect(res.status).toBe(200);
    expect(res.body.data.product.name).toBe('New');
    expect(res.body.data.product.price).toBe(25);
    expect(res.body.data.product.status).toBe(PRODUCT_STATUS.INACTIVE);
  });

  it('rejects an empty update (422)', async () => {
    const { token, org } = await makeActor();
    const p = await Product.create({ organization: org, name: 'X' });
    const res = await request(app).patch(`${PREFIX}/products/${p.id}`).set(bearer(token)).send({});
    expect(res.status).toBe(422);
  });

  it('forbids a member (no product:update) with 403', async () => {
    const { org } = await makeActor();
    const member = await makeActor({ role: ROLES.MEMBER, organization: org });
    const p = await Product.create({ organization: org, name: 'Locked' });
    const res = await request(app)
      .patch(`${PREFIX}/products/${p.id}`)
      .set(bearer(member.token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('DELETE /products/:id', () => {
  it('lets an admin delete a product', async () => {
    const { token, org } = await makeActor();
    const p = await Product.create({ organization: org, name: 'Gone' });
    const res = await request(app).delete(`${PREFIX}/products/${p.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(await Product.findById(p.id)).toBeNull();
  });

  it('forbids a manager (no product:delete) with 403', async () => {
    const { token, org } = await makeActor({ role: ROLES.MANAGER });
    const p = await Product.create({ organization: org, name: 'Safe' });
    const res = await request(app).delete(`${PREFIX}/products/${p.id}`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('returns 404 deleting a product in another org', async () => {
    const { token } = await makeActor();
    const other = await Product.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign' });
    const res = await request(app).delete(`${PREFIX}/products/${other.id}`).set(bearer(token));
    expect(res.status).toBe(404);
  });
});
