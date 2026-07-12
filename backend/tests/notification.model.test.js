/**
 * Notification model (Module 13 · Task 1): defaults, required fields, and the
 * type enum.
 */
import mongoose from 'mongoose';
import Notification from '../src/features/notifications/notification.model.js';
import { NOTIFICATION_TYPE } from '../src/config/constants.js';

function base(overrides = {}) {
  return {
    organization: new mongoose.Types.ObjectId(),
    recipient: new mongoose.Types.ObjectId(),
    title: 'A document needs your approval',
    ...overrides,
  };
}

describe('Notification model', () => {
  it('applies sensible defaults', async () => {
    const notification = await Notification.create(base());
    expect(notification.type).toBe(NOTIFICATION_TYPE.SYSTEM);
    expect(notification.body).toBeNull();
    expect(notification.link).toBeNull();
    expect(notification.data).toEqual({});
    expect(notification.readAt).toBeNull();
    expect(notification.actor).toBeNull();
  });

  it('requires organization, recipient, and title', async () => {
    await expect(Notification.create(base({ organization: undefined }))).rejects.toThrow(/Organization/);
    await expect(Notification.create(base({ recipient: undefined }))).rejects.toThrow(/Recipient/);
    await expect(Notification.create(base({ title: undefined }))).rejects.toThrow(/Title/);
  });

  it('rejects an unknown type', async () => {
    await expect(Notification.create(base({ type: 'telepathy' }))).rejects.toThrow();
  });

  it('accepts a known type and contextual data', async () => {
    const notification = await Notification.create(
      base({
        type: NOTIFICATION_TYPE.APPROVAL_REQUESTED,
        link: '/documents/abc',
        data: { documentId: 'abc' },
      })
    );
    expect(notification.type).toBe(NOTIFICATION_TYPE.APPROVAL_REQUESTED);
    expect(notification.link).toBe('/documents/abc');
    expect(notification.data).toEqual({ documentId: 'abc' });
  });

  it('drops __v in JSON output', async () => {
    const notification = await Notification.create(base());
    const json = notification.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBeDefined();
  });
});
