/**
 * EmailMessage model (Module 9 · Task 1): defaults, enums, and required fields.
 */
import mongoose from 'mongoose';
import EmailMessage from '../src/features/emails/email.model.js';
import { EMAIL_STATUS, EMAIL_TYPE, EMAIL_MAX_ATTEMPTS } from '../src/config/constants.js';

function base(overrides = {}) {
  return {
    organization: new mongoose.Types.ObjectId(),
    to: 'Ada@Example.com',
    subject: 'Your invoice',
    ...overrides,
  };
}

describe('EmailMessage model', () => {
  it('applies sensible defaults', async () => {
    const message = await EmailMessage.create(base());
    expect(message.status).toBe(EMAIL_STATUS.QUEUED);
    expect(message.type).toBe(EMAIL_TYPE.OTHER);
    expect(message.attempts).toBe(0);
    expect(message.maxAttempts).toBe(EMAIL_MAX_ATTEMPTS);
    expect(message.document).toBeNull();
    expect(message.attachPdf).toBe(false);
    expect(message.sentAt).toBeNull();
  });

  it('lowercases + trims the recipient address', async () => {
    const message = await EmailMessage.create(base({ to: '  Ada@Example.com  ' }));
    expect(message.to).toBe('ada@example.com');
  });

  it('requires organization, to, and subject', async () => {
    await expect(EmailMessage.create({ to: 'a@b.co', subject: 'x' })).rejects.toThrow(/Organization/);
    await expect(
      EmailMessage.create({ organization: new mongoose.Types.ObjectId(), subject: 'x' })
    ).rejects.toThrow(/Recipient/);
    await expect(
      EmailMessage.create({ organization: new mongoose.Types.ObjectId(), to: 'a@b.co' })
    ).rejects.toThrow(/Subject/);
  });

  it('rejects an unknown status', async () => {
    await expect(EmailMessage.create(base({ status: 'exploded' }))).rejects.toThrow();
  });

  it('strips __v and exposes id in JSON', async () => {
    const message = await EmailMessage.create(base());
    const json = message.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBe(message.id);
  });
});
