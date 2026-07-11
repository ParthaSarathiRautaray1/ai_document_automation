/**
 * Document generation + CRUD (Module 7 · Task 2):
 *   GET/POST /documents, POST /documents/generate, GET/PATCH/DELETE /documents/:id,
 *   POST /documents/:id/regenerate.
 * Covers the permission gates, tenant isolation, generation from a template
 * (render + snapshot), pagination/search/filter, and the update/regenerate/delete
 * happy paths over HTTP.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Template from '../src/features/templates/template.model.js';
import Document from '../src/features/documents/document.model.js';
import Customer from '../src/features/customers/customer.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, DOCUMENT_TYPE, DOCUMENT_STATUS, TEMPLATE_TYPE } from '../src/config/constants.js';

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

function makeTemplate(org, overrides = {}) {
  return Template.create({
    organization: org,
    name: 'Invoice',
    type: TEMPLATE_TYPE.INVOICE,
    content: 'Dear {{name}} — total {{total}}',
    variables: [
      { key: 'name', required: true },
      { key: 'total', required: true, defaultValue: '0' },
    ],
    ...overrides,
  });
}

describe('POST /documents/generate', () => {
  it('renders content, captures a snapshot, and inherits title/type from the template', async () => {
    const { token, org, user } = await makeActor();
    const template = await makeTemplate(org);

    const res = await request(app)
      .post(`${PREFIX}/documents/generate`)
      .set(bearer(token))
      .send({ templateId: template.id, values: { name: 'Ada' } });

    expect(res.status).toBe(201);
    const doc = res.body.data.document;
    expect(doc.title).toBe('Invoice');
    expect(doc.type).toBe(DOCUMENT_TYPE.INVOICE);
    expect(doc.status).toBe(DOCUMENT_STATUS.DRAFT);
    expect(doc.organization).toBe(org.toString());
    expect(doc.createdBy).toBe(user.id);
    expect(doc.template).toBe(template.id);
    expect(doc.content).toBe('Dear Ada — total 0'); // total uses its default
    expect(doc.missingRequired).toEqual([]);
    expect(doc.templateSnapshot.content).toBe('Dear {{name}} — total {{total}}');
    expect(doc.values).toEqual({ name: 'Ada' });
  });

  it('reports missing required values and honours a title override', async () => {
    const { token, org } = await makeActor();
    const template = await makeTemplate(org, {
      variables: [{ key: 'name', required: true }, { key: 'total', required: true }],
    });

    const res = await request(app)
      .post(`${PREFIX}/documents/generate`)
      .set(bearer(token))
      .send({ templateId: template.id, title: 'March Invoice', values: { name: 'Ada' } });

    expect(res.status).toBe(201);
    expect(res.body.data.document.title).toBe('March Invoice');
    expect(res.body.data.document.content).toBe('Dear Ada — total {{total}}');
    expect(res.body.data.document.missingRequired).toEqual(['total']);
  });

  it('links a customer in the same org', async () => {
    const { token, org } = await makeActor();
    const template = await makeTemplate(org);
    const customer = await Customer.create({ organization: org, name: 'Acme' });

    const res = await request(app)
      .post(`${PREFIX}/documents/generate`)
      .set(bearer(token))
      .send({ templateId: template.id, customerId: customer.id, values: { name: 'Ada', total: '9' } });

    expect(res.status).toBe(201);
    expect(res.body.data.document.customer).toBe(customer.id);
  });

  it('404s generating from a template in another org (isolation)', async () => {
    const { token } = await makeActor();
    const foreign = await makeTemplate(new mongoose.Types.ObjectId());
    const res = await request(app)
      .post(`${PREFIX}/documents/generate`)
      .set(bearer(token))
      .send({ templateId: foreign.id, values: {} });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('404s linking a customer in another org', async () => {
    const { token, org } = await makeActor();
    const template = await makeTemplate(org);
    const foreignCustomer = await Customer.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign' });
    const res = await request(app)
      .post(`${PREFIX}/documents/generate`)
      .set(bearer(token))
      .send({ templateId: template.id, customerId: foreignCustomer.id, values: {} });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CUSTOMER_NOT_FOUND');
  });

  it('forbids a member without document:create (403)', async () => {
    const { token, org } = await makeActor({ role: ROLES.MEMBER });
    const template = await makeTemplate(org);
    const res = await request(app)
      .post(`${PREFIX}/documents/generate`)
      .set(bearer(token))
      .send({ templateId: template.id, values: {} });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('GET /documents', () => {
  it('lists only the actor org documents (tenant isolation), paginated', async () => {
    const { token, org } = await makeActor();
    await Document.create([
      { organization: org, title: 'Mine One', content: 'a' },
      { organization: org, title: 'Mine Two', content: 'b' },
      { organization: new mongoose.Types.ObjectId(), title: 'Someone Else', content: 'c' },
    ]);

    const res = await request(app).get(`${PREFIX}/documents`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.documents.map((d) => d.title).sort()).toEqual(['Mine One', 'Mine Two']);
  });

  it('searches by title and filters by status', async () => {
    const { token, org } = await makeActor();
    await Document.create([
      { organization: org, title: 'Blue Invoice', content: 'x', status: DOCUMENT_STATUS.FINAL },
      { organization: org, title: 'Green Quote', content: 'y', status: DOCUMENT_STATUS.DRAFT },
    ]);

    const search = await request(app).get(`${PREFIX}/documents?q=blue`).set(bearer(token));
    expect(search.body.data.documents).toHaveLength(1);
    expect(search.body.data.documents[0].title).toBe('Blue Invoice');

    const filtered = await request(app)
      .get(`${PREFIX}/documents?status=${DOCUMENT_STATUS.FINAL}`)
      .set(bearer(token));
    expect(filtered.body.data.documents).toHaveLength(1);
    expect(filtered.body.data.documents[0].title).toBe('Blue Invoice');
  });

  it('allows a member to read (document:read)', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/documents`).set(bearer(token));
    expect(res.status).toBe(200);
  });
});

describe('GET /documents/:id', () => {
  it('returns a document in the actor org', async () => {
    const { token, org } = await makeActor();
    const d = await Document.create({ organization: org, title: 'Readable', content: 'x' });
    const res = await request(app).get(`${PREFIX}/documents/${d.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.document.title).toBe('Readable');
  });

  it('returns 404 for a document in another org (isolation)', async () => {
    const { token } = await makeActor();
    const other = await Document.create({ organization: new mongoose.Types.ObjectId(), title: 'Foreign', content: 'x' });
    const res = await request(app).get(`${PREFIX}/documents/${other.id}`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DOCUMENT_NOT_FOUND');
  });
});

describe('POST /documents/:id/regenerate', () => {
  it('re-renders from the stored snapshot with new values', async () => {
    const { token, org } = await makeActor();
    const template = await makeTemplate(org);
    const gen = await request(app)
      .post(`${PREFIX}/documents/generate`)
      .set(bearer(token))
      .send({ templateId: template.id, values: { name: 'Ada' } });
    const id = gen.body.data.document.id;

    // The source template changes — regeneration must still use the snapshot.
    await Template.findByIdAndUpdate(template.id, { content: 'totally different' });

    const res = await request(app)
      .post(`${PREFIX}/documents/${id}/regenerate`)
      .set(bearer(token))
      .send({ values: { name: 'Grace', total: '42' } });

    expect(res.status).toBe(200);
    expect(res.body.data.document.content).toBe('Dear Grace — total 42');
    expect(res.body.data.document.values).toEqual({ name: 'Grace', total: '42' });
  });
});

describe('PATCH /documents/:id', () => {
  it('updates editable fields (title, status, content)', async () => {
    const { token, org } = await makeActor();
    const d = await Document.create({ organization: org, title: 'Old', content: 'x' });
    const res = await request(app)
      .patch(`${PREFIX}/documents/${d.id}`)
      .set(bearer(token))
      .send({ title: 'New', status: DOCUMENT_STATUS.FINAL, content: 'edited body' });
    expect(res.status).toBe(200);
    expect(res.body.data.document.title).toBe('New');
    expect(res.body.data.document.status).toBe(DOCUMENT_STATUS.FINAL);
    expect(res.body.data.document.content).toBe('edited body');
  });

  it('rejects an empty update (422)', async () => {
    const { token, org } = await makeActor();
    const d = await Document.create({ organization: org, title: 'X', content: 'x' });
    const res = await request(app).patch(`${PREFIX}/documents/${d.id}`).set(bearer(token)).send({});
    expect(res.status).toBe(422);
  });

  it('forbids a member (no document:update) with 403', async () => {
    const { org } = await makeActor();
    const member = await makeActor({ role: ROLES.MEMBER, organization: org });
    const d = await Document.create({ organization: org, title: 'Locked', content: 'x' });
    const res = await request(app)
      .patch(`${PREFIX}/documents/${d.id}`)
      .set(bearer(member.token))
      .send({ title: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('DELETE /documents/:id', () => {
  it('lets an admin delete a document', async () => {
    const { token, org } = await makeActor();
    const d = await Document.create({ organization: org, title: 'Gone', content: 'x' });
    const res = await request(app).delete(`${PREFIX}/documents/${d.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(await Document.findById(d.id)).toBeNull();
  });

  it('forbids a manager (no document:delete) with 403', async () => {
    const { token, org } = await makeActor({ role: ROLES.MANAGER });
    const d = await Document.create({ organization: org, title: 'Safe', content: 'x' });
    const res = await request(app).delete(`${PREFIX}/documents/${d.id}`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});
