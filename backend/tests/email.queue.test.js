/**
 * Email queue (Module 9 · Task 2): enqueue + processMessage status/retry
 * accounting. The low-level provider (services/email.service) is mocked so we can
 * drive the sent / skipped / failed paths deterministically (no network).
 */
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

const sendTransactionalEmail = jest.fn();

jest.unstable_mockModule('../src/services/email.service.js', () => ({
  sendTransactionalEmail,
  // other named exports are not used by the queue
  sendPasswordResetEmail: jest.fn(),
  sendInvitationEmail: jest.fn(),
}));

const { default: EmailMessage } = await import('../src/features/emails/email.model.js');
const { enqueueEmail, processMessage } = await import('../src/features/emails/email.queue.js');
const { EMAIL_STATUS } = await import('../src/config/constants.js');

function base(overrides = {}) {
  return {
    organization: new mongoose.Types.ObjectId(),
    to: 'ada@example.com',
    subject: 'Hello',
    html: '<p>Hi</p>',
    text: 'Hi',
    maxAttempts: 3,
    ...overrides,
  };
}

beforeEach(() => {
  sendTransactionalEmail.mockReset();
});

describe('enqueueEmail', () => {
  it('persists a message in the queued state', async () => {
    const message = await enqueueEmail(base());
    expect(message.status).toBe(EMAIL_STATUS.QUEUED);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});

describe('processMessage', () => {
  it('marks a delivered message sent and records the provider id', async () => {
    sendTransactionalEmail.mockResolvedValue({ delivered: true, messageId: 'msg-1' });
    const message = await enqueueEmail(base());

    await processMessage(message, [{ name: 'doc.pdf', content: 'AAAA' }]);

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail.mock.calls[0][0].attachments).toEqual([
      { name: 'doc.pdf', content: 'AAAA' },
    ]);
    const reloaded = await EmailMessage.findById(message.id);
    expect(reloaded.status).toBe(EMAIL_STATUS.SENT);
    expect(reloaded.providerMessageId).toBe('msg-1');
    expect(reloaded.attempts).toBe(1);
    expect(reloaded.sentAt).toBeInstanceOf(Date);
  });

  it('marks a skipped send (no provider) as skipped, not failed', async () => {
    sendTransactionalEmail.mockResolvedValue({ delivered: false, skipped: true });
    const message = await enqueueEmail(base());

    await processMessage(message);

    const reloaded = await EmailMessage.findById(message.id);
    expect(reloaded.status).toBe(EMAIL_STATUS.SKIPPED);
    expect(reloaded.sentAt).toBeInstanceOf(Date);
  });

  it('keeps a message queued after a failure while retries remain', async () => {
    sendTransactionalEmail.mockRejectedValue(new Error('provider 500'));
    const message = await enqueueEmail(base({ maxAttempts: 2 }));

    await processMessage(message);

    const reloaded = await EmailMessage.findById(message.id);
    expect(reloaded.status).toBe(EMAIL_STATUS.QUEUED);
    expect(reloaded.attempts).toBe(1);
    expect(reloaded.lastError).toMatch(/provider 500/);
  });

  it('marks a message failed once the attempt budget is exhausted', async () => {
    sendTransactionalEmail.mockRejectedValue(new Error('down'));
    const message = await enqueueEmail(base({ maxAttempts: 1 }));

    await processMessage(message);

    const reloaded = await EmailMessage.findById(message.id);
    expect(reloaded.status).toBe(EMAIL_STATUS.FAILED);
    expect(reloaded.attempts).toBe(1);
  });
});
