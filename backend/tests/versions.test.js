/**
 * Version-history API (Module 12 · Task 2), nested under a document:
 *   GET /documents/:id/versions, GET /documents/:id/versions/:versionId,
 *   GET /documents/:id/versions/diff, POST /documents/:id/versions/:versionId/restore.
 * Covers automatic capture on generate/edit/regenerate, the permission gate,
 * tenant isolation, diffing, and restore (append-only history).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import Document from '../src/features/documents/document.model.js';
import Template from '../src/features/templates/template.model.js';
import DocumentVersion from '../src/features/versions/version.model.js';
import { signAccessToken } from '../src/utils/token.js';
import { ROLES, VERSION_CHANGE_TYPE } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser({ role = ROLES.MANAGER, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'Ver',
    lastName: 'Sion',
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

function makeTemplate(org, overrides = {}) {
  return Template.create({
    organization: org,
    name: 'Greeting',
    content: 'Hello {{name}}',
    variables: [{ key: 'name', label: 'Name', type: 'text', required: true }],
    ...overrides,
  });
}

/** Generate a document over HTTP and return its record. */
async function generate(token, templateId, values = { name: 'Ada' }) {
  const res = await request(app)
    .post(`${PREFIX}/documents/generate`)
    .set(bearer(token))
    .send({ templateId, values });
  return res.body.data.document;
}

async function listVersions(token, documentId) {
  const res = await request(app).get(`${PREFIX}/documents/${documentId}/versions`).set(bearer(token));
  return res;
}

describe('version capture (automatic)', () => {
  it('captures v1 on generation', async () => {
    const { token, org } = await makeUser();
    const template = await makeTemplate(org);
    const document = await generate(token, template.id);

    const res = await listVersions(token, document.id);
    expect(res.status).toBe(200);
    expect(res.body.data.versions).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    const [v1] = res.body.data.versions;
    expect(v1.version).toBe(1);
    expect(v1.changeType).toBe(VERSION_CHANGE_TYPE.GENERATED);
    expect(v1.content).toBe('Hello Ada');
  });

  it('appends an "edited" version when content changes, but not on metadata-only edits', async () => {
    const { token, org } = await makeUser();
    const template = await makeTemplate(org);
    const document = await generate(token, template.id);

    // Content edit → new version.
    await request(app)
      .patch(`${PREFIX}/documents/${document.id}`)
      .set(bearer(token))
      .send({ content: 'Hello Bob' });

    let res = await listVersions(token, document.id);
    expect(res.body.data.versions).toHaveLength(2);
    // Newest first (default sort by -version).
    expect(res.body.data.versions[0].version).toBe(2);
    expect(res.body.data.versions[0].changeType).toBe(VERSION_CHANGE_TYPE.EDITED);
    expect(res.body.data.versions[0].content).toBe('Hello Bob');

    // Metadata-only edit → no new version.
    await request(app)
      .patch(`${PREFIX}/documents/${document.id}`)
      .set(bearer(token))
      .send({ status: 'final' });

    res = await listVersions(token, document.id);
    expect(res.body.data.versions).toHaveLength(2);
  });

  it('appends a "regenerated" version on regenerate', async () => {
    const { token, org } = await makeUser();
    const template = await makeTemplate(org);
    const document = await generate(token, template.id);

    await request(app)
      .post(`${PREFIX}/documents/${document.id}/regenerate`)
      .set(bearer(token))
      .send({ values: { name: 'Cy' } });

    const res = await listVersions(token, document.id);
    expect(res.body.data.versions).toHaveLength(2);
    expect(res.body.data.versions[0].changeType).toBe(VERSION_CHANGE_TYPE.REGENERATED);
    expect(res.body.data.versions[0].content).toBe('Hello Cy');
  });
});

describe('GET /documents/:id/versions', () => {
  it('404s for a document in another org (isolation)', async () => {
    const { token } = await makeUser();
    const foreign = await Document.create({
      organization: new mongoose.Types.ObjectId(),
      title: 'X',
      content: 'y',
    });
    const res = await listVersions(token, foreign.id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('allows a member to read version history (version:read)', async () => {
    const { token, org } = await makeUser({ role: ROLES.MEMBER });
    const document = await Document.create({ organization: org, title: 'D', content: 'body' });
    const res = await listVersions(token, document.id);
    expect(res.status).toBe(200);
    expect(res.body.data.versions).toEqual([]);
  });
});

describe('GET /documents/:id/versions/:versionId', () => {
  it('returns a single version, and 404s for an unknown one', async () => {
    const { token, org } = await makeUser();
    const document = await Document.create({ organization: org, title: 'D', content: 'body' });
    const version = await DocumentVersion.create({
      organization: org,
      document: document.id,
      version: 1,
      content: 'body',
    });

    const ok = await request(app)
      .get(`${PREFIX}/documents/${document.id}/versions/${version.id}`)
      .set(bearer(token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.version.id).toBe(version.id);

    const missing = await request(app)
      .get(`${PREFIX}/documents/${document.id}/versions/${new mongoose.Types.ObjectId()}`)
      .set(bearer(token));
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('VERSION_NOT_FOUND');
  });
});

describe('GET /documents/:id/versions/diff', () => {
  it('computes a line diff between two versions', async () => {
    const { token, org } = await makeUser();
    const document = await Document.create({ organization: org, title: 'D', content: 'b' });
    const v1 = await DocumentVersion.create({
      organization: org,
      document: document.id,
      version: 1,
      content: 'a\nb\nc',
    });
    const v2 = await DocumentVersion.create({
      organization: org,
      document: document.id,
      version: 2,
      content: 'a\nc',
    });

    const res = await request(app)
      .get(`${PREFIX}/documents/${document.id}/versions/diff?from=${v1.id}&to=${v2.id}`)
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.from.id).toBe(v1.id);
    expect(res.body.data.to.id).toBe(v2.id);
    expect(res.body.data.diff.stats).toEqual({ added: 0, removed: 1, unchanged: 2 });
    expect(res.body.data.diff.changes.map((c) => c.type)).toEqual([
      'unchanged',
      'removed',
      'unchanged',
    ]);
  });
});

describe('POST /documents/:id/versions/:versionId/restore', () => {
  async function seed() {
    const { token, org } = await makeUser();
    const template = await makeTemplate(org);
    const document = await generate(token, template.id); // v1: 'Hello Ada'
    await request(app)
      .patch(`${PREFIX}/documents/${document.id}`)
      .set(bearer(token))
      .send({ content: 'Hello Bob' }); // v2: 'Hello Bob'
    return { token, org, document };
  }

  it('rolls the document back and appends a "restored" version', async () => {
    const { token, document } = await seed();
    const v1 = (await listVersions(token, document.id)).body.data.versions.find((v) => v.version === 1);

    const res = await request(app)
      .post(`${PREFIX}/documents/${document.id}/versions/${v1.id}/restore`)
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.document.content).toBe('Hello Ada');

    const after = await listVersions(token, document.id);
    expect(after.body.data.versions).toHaveLength(3);
    expect(after.body.data.versions[0].version).toBe(3);
    expect(after.body.data.versions[0].changeType).toBe(VERSION_CHANGE_TYPE.RESTORED);
    expect(after.body.data.versions[0].content).toBe('Hello Ada');
  });

  it('forbids a member without version:restore (403)', async () => {
    const admin = await makeUser();
    const template = await makeTemplate(admin.org);
    const document = await generate(admin.token, template.id);
    const version = (await listVersions(admin.token, document.id)).body.data.versions[0];

    const member = await makeUser({ role: ROLES.MEMBER, organization: admin.org });
    const res = await request(app)
      .post(`${PREFIX}/documents/${document.id}/versions/${version.id}/restore`)
      .set(bearer(member.token));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});
