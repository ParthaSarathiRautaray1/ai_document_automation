/**
 * Template CRUD + render (Module 6 · Tasks 2–3):
 *   GET/POST /templates, GET/PATCH/DELETE /templates/:id, POST /templates/:id/render.
 * Covers the permission gates, tenant isolation, pagination/search/filter, the
 * create/update/delete happy paths, and the render preview engine over HTTP.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Template from '../src/features/templates/template.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, TEMPLATE_TYPE, TEMPLATE_STATUS } from '../src/config/constants.js';

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

describe('POST /templates', () => {
  it('creates a template in the actor org (createdBy set, defaults applied)', async () => {
    const { token, org, user } = await makeActor();
    const res = await request(app)
      .post(`${PREFIX}/templates`)
      .set(bearer(token))
      .send({ name: 'Welcome Letter', content: 'Dear {{name}}', variables: [{ key: 'name', required: true }] });

    expect(res.status).toBe(201);
    expect(res.body.data.template.name).toBe('Welcome Letter');
    expect(res.body.data.template.organization).toBe(org.toString());
    expect(res.body.data.template.createdBy).toBe(user.id);
    expect(res.body.data.template.status).toBe(TEMPLATE_STATUS.DRAFT);
    expect(res.body.data.template.type).toBe(TEMPLATE_TYPE.OTHER);
    expect(res.body.data.template.variables).toHaveLength(1);
    expect(res.body.data.template.variables[0].key).toBe('name');
  });

  it('forbids a member without template:create (403 FORBIDDEN_PERMISSION)', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app)
      .post(`${PREFIX}/templates`)
      .set(bearer(token))
      .send({ name: 'Nope', content: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('rejects a missing name or content (422)', async () => {
    const { token } = await makeActor();
    expect((await request(app).post(`${PREFIX}/templates`).set(bearer(token)).send({ content: 'x' })).status).toBe(422);
    expect((await request(app).post(`${PREFIX}/templates`).set(bearer(token)).send({ name: 'x' })).status).toBe(422);
  });

  it('rejects duplicate variable keys (422)', async () => {
    const { token } = await makeActor();
    const res = await request(app)
      .post(`${PREFIX}/templates`)
      .set(bearer(token))
      .send({ name: 'Dupe', content: '{{a}}', variables: [{ key: 'a' }, { key: 'a' }] });
    expect(res.status).toBe(422);
  });
});

describe('GET /templates', () => {
  it('lists only the actor org templates (tenant isolation), paginated', async () => {
    const { token, org } = await makeActor();
    await Template.create([
      { organization: org, name: 'Mine One', content: 'a' },
      { organization: org, name: 'Mine Two', content: 'b' },
      { organization: new mongoose.Types.ObjectId(), name: 'Someone Else', content: 'c' },
    ]);

    const res = await request(app).get(`${PREFIX}/templates`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.templates).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.templates.map((t) => t.name).sort()).toEqual(['Mine One', 'Mine Two']);
  });

  it('searches by name/description and filters by type', async () => {
    const { token, org } = await makeActor();
    await Template.create([
      { organization: org, name: 'Blue Invoice', content: 'x', type: TEMPLATE_TYPE.INVOICE, description: 'billing doc' },
      { organization: org, name: 'Support Contract', content: 'y', type: TEMPLATE_TYPE.CONTRACT },
    ]);

    const search = await request(app).get(`${PREFIX}/templates?q=billing`).set(bearer(token));
    expect(search.body.data.templates).toHaveLength(1);
    expect(search.body.data.templates[0].name).toBe('Blue Invoice');

    const filtered = await request(app)
      .get(`${PREFIX}/templates?type=${TEMPLATE_TYPE.CONTRACT}`)
      .set(bearer(token));
    expect(filtered.body.data.templates).toHaveLength(1);
    expect(filtered.body.data.templates[0].name).toBe('Support Contract');
  });

  it('allows a member to read (template:read)', async () => {
    const { token } = await makeActor({ role: ROLES.MEMBER });
    const res = await request(app).get(`${PREFIX}/templates`).set(bearer(token));
    expect(res.status).toBe(200);
  });
});

describe('GET /templates/:id', () => {
  it('returns a template in the actor org', async () => {
    const { token, org } = await makeActor();
    const t = await Template.create({ organization: org, name: 'Readable', content: 'x' });
    const res = await request(app).get(`${PREFIX}/templates/${t.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.template.name).toBe('Readable');
  });

  it('returns 404 for a template in another org (isolation)', async () => {
    const { token } = await makeActor();
    const other = await Template.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign', content: 'x' });
    const res = await request(app).get(`${PREFIX}/templates/${other.id}`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TEMPLATE_NOT_FOUND');
  });
});

describe('PATCH /templates/:id', () => {
  it('updates fields including the variables array', async () => {
    const { token, org } = await makeActor();
    const t = await Template.create({ organization: org, name: 'Old', content: 'x' });
    const res = await request(app)
      .patch(`${PREFIX}/templates/${t.id}`)
      .set(bearer(token))
      .send({ name: 'New', status: TEMPLATE_STATUS.ACTIVE, variables: [{ key: 'greeting', defaultValue: 'Hello' }] });
    expect(res.status).toBe(200);
    expect(res.body.data.template.name).toBe('New');
    expect(res.body.data.template.status).toBe(TEMPLATE_STATUS.ACTIVE);
    expect(res.body.data.template.variables).toHaveLength(1);
    expect(res.body.data.template.variables[0].defaultValue).toBe('Hello');
  });

  it('rejects an empty update (422)', async () => {
    const { token, org } = await makeActor();
    const t = await Template.create({ organization: org, name: 'X', content: 'x' });
    const res = await request(app).patch(`${PREFIX}/templates/${t.id}`).set(bearer(token)).send({});
    expect(res.status).toBe(422);
  });

  it('forbids a member (no template:update) with 403', async () => {
    const { org } = await makeActor();
    const member = await makeActor({ role: ROLES.MEMBER, organization: org });
    const t = await Template.create({ organization: org, name: 'Locked', content: 'x' });
    const res = await request(app)
      .patch(`${PREFIX}/templates/${t.id}`)
      .set(bearer(member.token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('DELETE /templates/:id', () => {
  it('lets an admin delete a template', async () => {
    const { token, org } = await makeActor();
    const t = await Template.create({ organization: org, name: 'Gone', content: 'x' });
    const res = await request(app).delete(`${PREFIX}/templates/${t.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(await Template.findById(t.id)).toBeNull();
  });

  it('forbids a manager (no template:delete) with 403', async () => {
    const { token, org } = await makeActor({ role: ROLES.MANAGER });
    const t = await Template.create({ organization: org, name: 'Safe', content: 'x' });
    const res = await request(app).delete(`${PREFIX}/templates/${t.id}`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});

describe('POST /templates/:id/render', () => {
  it('renders content with supplied values, defaults, and reports missing required', async () => {
    const { token, org } = await makeActor();
    const t = await Template.create({
      organization: org,
      name: 'Letter',
      content: 'Dear {{name}} at {{company}} — total {{total}}',
      variables: [
        { key: 'name', required: true },
        { key: 'company', defaultValue: 'Acme Inc' },
        { key: 'total', required: true },
      ],
    });

    const res = await request(app)
      .post(`${PREFIX}/templates/${t.id}/render`)
      .set(bearer(token))
      .send({ values: { name: 'Ada' } });

    expect(res.status).toBe(200);
    expect(res.body.data.render.content).toBe('Dear Ada at Acme Inc — total {{total}}');
    expect(res.body.data.render.missingRequired).toEqual(['total']);
  });

  it('allows a member to render (template:read) and defaults values to {}', async () => {
    const { token, org } = await makeActor({ role: ROLES.MEMBER });
    const t = await Template.create({ organization: org, name: 'M', content: 'Hi {{name}}' });
    const res = await request(app).post(`${PREFIX}/templates/${t.id}/render`).set(bearer(token)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.render.content).toBe('Hi {{name}}');
  });

  it('returns 404 rendering a template in another org', async () => {
    const { token } = await makeActor();
    const other = await Template.create({ organization: new mongoose.Types.ObjectId(), name: 'Foreign', content: 'x' });
    const res = await request(app)
      .post(`${PREFIX}/templates/${other.id}/render`)
      .set(bearer(token))
      .send({ values: {} });
    expect(res.status).toBe(404);
  });
});
