/**
 * Document delivery (Module 9): POST /documents/:id/send.
 *
 * The headless-browser renderer is mocked so the suite stays hermetic (no
 * Chromium). With no BREVO_API_KEY configured in tests the provider send is
 * SKIPPED, so a queued message ends in the `skipped` state — we assert the
 * message is persisted/linked, recipient resolution, the permission gate, and
 * tenant isolation.
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
const { default: Customer } = await import('../src/features/customers/customer.model.js');
const { default: EmailMessage } = await import('../src/features/emails/email.model.js');
const { signAccessToken } = await import('../src/utils/token.js');
const { ROLES, EMAIL_STATUS, EMAIL_TYPE } = await import('../src/config/constants.js');

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeActor({ role = ROLES.MANAGER, organization } = {}) {
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

describe('POST /documents/:id/send', () => {
  it('queues a delivery to an explicit recipient with the PDF attached', async () => {
    const { token, org, user } = await makeActor();
    const doc = await Document.create({ organization: org, title: 'March Invoice', content: 'Dear Ada' });

    const res = await request(app)
      .post(`${PREFIX}/documents/${doc.id}/send`)
      .set(bearer(token))
      .send({ to: 'client@example.com', message: 'Thanks for your business' });

    expect(res.status).toBe(201);
    const email = res.body.data.email;
    expect(email.to).toBe('client@example.com');
    expect(email.type).toBe(EMAIL_TYPE.DOCUMENT_DELIVERY);
    expect(email.document).toBe(doc.id);
    expect(email.attachPdf).toBe(true);
    expect(email.createdBy).toBe(user.id);
    // No provider configured in tests → skipped (attempted once, not failed).
    expect(email.status).toBe(EMAIL_STATUS.SKIPPED);
    expect(email.attempts).toBe(1);

    // The PDF was rendered for the attachment.
    expect(renderHtmlToPdf).toHaveBeenCalledTimes(1);

    // Persisted in the org's email log.
    const stored = await EmailMessage.findById(email.id);
    expect(stored).not.toBeNull();
    expect(stored.subject).toContain('March Invoice');
  });

  it('resolves the recipient from the linked customer when none is given', async () => {
    const { token, org } = await makeActor();
    const customer = await Customer.create({
      organization: org,
      name: 'Acme',
      email: 'billing@acme.test',
    });
    const doc = await Document.create({
      organization: org,
      title: 'Quote',
      content: 'x',
      customer: customer.id,
    });

    const res = await request(app).post(`${PREFIX}/documents/${doc.id}/send`).set(bearer(token)).send({});

    expect(res.status).toBe(201);
    expect(res.body.data.email.to).toBe('billing@acme.test');
  });

  it('falls back to a primary contact email on the customer', async () => {
    const { token, org } = await makeActor();
    const customer = await Customer.create({
      organization: org,
      name: 'Acme',
      contacts: [
        { name: 'Secondary', email: 'second@acme.test' },
        { name: 'Primary', email: 'primary@acme.test', isPrimary: true },
      ],
    });
    const doc = await Document.create({
      organization: org,
      title: 'Quote',
      content: 'x',
      customer: customer.id,
    });

    const res = await request(app).post(`${PREFIX}/documents/${doc.id}/send`).set(bearer(token)).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.email.to).toBe('primary@acme.test');
  });

  it('400s NO_RECIPIENT when no address can be resolved', async () => {
    const { token, org } = await makeActor();
    const doc = await Document.create({ organization: org, title: 'Orphan', content: 'x' });

    const res = await request(app).post(`${PREFIX}/documents/${doc.id}/send`).set(bearer(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_RECIPIENT');
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it('can skip the attachment (attachPdf:false) without rendering a PDF', async () => {
    const { token, org } = await makeActor();
    const doc = await Document.create({ organization: org, title: 'No PDF', content: 'x' });

    const res = await request(app)
      .post(`${PREFIX}/documents/${doc.id}/send`)
      .set(bearer(token))
      .send({ to: 'c@example.com', attachPdf: false });

    expect(res.status).toBe(201);
    expect(res.body.data.email.attachPdf).toBe(false);
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it('forbids a member (no document:send) with 403', async () => {
    const { token, org } = await makeActor({ role: ROLES.MEMBER });
    const doc = await Document.create({ organization: org, title: 'X', content: 'x' });
    const res = await request(app)
      .post(`${PREFIX}/documents/${doc.id}/send`)
      .set(bearer(token))
      .send({ to: 'c@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('404s a document in another org (isolation)', async () => {
    const { token } = await makeActor();
    const foreign = await Document.create({
      organization: new mongoose.Types.ObjectId(),
      title: 'Foreign',
      content: 'x',
    });
    const res = await request(app)
      .post(`${PREFIX}/documents/${foreign.id}/send`)
      .set(bearer(token))
      .send({ to: 'c@example.com' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('rejects an unauthenticated request (401)', async () => {
    const { org } = await makeActor();
    const doc = await Document.create({ organization: org, title: 'X', content: 'x' });
    const res = await request(app).post(`${PREFIX}/documents/${doc.id}/send`).send({ to: 'c@example.com' });
    expect(res.status).toBe(401);
  });
});
