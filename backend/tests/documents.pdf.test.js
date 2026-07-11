/**
 * Document PDF export (Module 8 · Task 2): GET /documents/:id/pdf.
 *
 * The headless-browser renderer is mocked so the suite stays hermetic (no
 * Chromium launch): we assert the route builds HTML from the right document,
 * streams it as an application/pdf attachment, enforces tenant isolation, and is
 * open to anyone with document:export (members included).
 */
import { jest } from '@jest/globals';

const renderHtmlToPdf = jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake'));

jest.unstable_mockModule('../src/features/documents/pdf.renderer.js', () => ({
  renderHtmlToPdf,
  closeBrowser: jest.fn().mockResolvedValue(undefined),
}));

const mongoose = (await import('mongoose')).default;
const request = (await import('supertest')).default;
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/features/users/user.model.js');
const { default: Document } = await import('../src/features/documents/document.model.js');
const { signAccessToken } = await import('../src/utils/token.js');
const { ROLES } = await import('../src/config/constants.js');

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

beforeEach(() => {
  renderHtmlToPdf.mockClear();
});

describe('GET /documents/:id/pdf', () => {
  it('streams a PDF attachment built from the document', async () => {
    const { token, org } = await makeActor();
    const doc = await Document.create({ organization: org, title: 'March Invoice', content: 'Dear Ada' });

    const res = await request(app).get(`${PREFIX}/documents/${doc.id}/pdf`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="march-invoice.pdf"');

    // The renderer received HTML derived from this document.
    expect(renderHtmlToPdf).toHaveBeenCalledTimes(1);
    const html = renderHtmlToPdf.mock.calls[0][0];
    expect(html).toContain('<title>March Invoice</title>');
    expect(html).toContain('Dear Ada');
  });

  it('lets a member export (document:export)', async () => {
    const { token, org } = await makeActor({ role: ROLES.MEMBER });
    const doc = await Document.create({ organization: org, title: 'Readable', content: 'x' });
    const res = await request(app).get(`${PREFIX}/documents/${doc.id}/pdf`).set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('404s a document in another org without invoking the renderer (isolation)', async () => {
    const { token } = await makeActor();
    const foreign = await Document.create({
      organization: new mongoose.Types.ObjectId(),
      title: 'Foreign',
      content: 'x',
    });
    const res = await request(app).get(`${PREFIX}/documents/${foreign.id}/pdf`).set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DOCUMENT_NOT_FOUND');
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request (401)', async () => {
    const { org } = await makeActor();
    const doc = await Document.create({ organization: org, title: 'X', content: 'x' });
    const res = await request(app).get(`${PREFIX}/documents/${doc.id}/pdf`);
    expect(res.status).toBe(401);
  });
});
