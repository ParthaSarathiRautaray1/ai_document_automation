import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/features/notifications/notifications.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listNotifications', () => {
  it('unwraps notifications + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: {
        data: { notifications: [{ id: 'n1' }] },
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      },
    });
    const result = await listNotifications({ page: 1, status: 'unread', type: undefined, q: '' });
    expect(api.get).toHaveBeenCalledWith('/notifications', {
      params: { page: 1, status: 'unread' },
    });
    expect(result).toEqual({
      notifications: [{ id: 'n1' }],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });
});

describe('getUnreadCount', () => {
  it('unwraps the unread count', async () => {
    api.get.mockResolvedValue({ data: { data: { unread: 3 } } });
    const unread = await getUnreadCount();
    expect(api.get).toHaveBeenCalledWith('/notifications/unread-count');
    expect(unread).toBe(3);
  });
});

describe('markNotificationRead', () => {
  it('PATCHes /read and unwraps the notification', async () => {
    api.patch.mockResolvedValue({ data: { data: { notification: { id: 'n1', readAt: 'now' } } } });
    const notification = await markNotificationRead('n1');
    expect(api.patch).toHaveBeenCalledWith('/notifications/n1/read');
    expect(notification).toEqual({ id: 'n1', readAt: 'now' });
  });
});

describe('markAllNotificationsRead', () => {
  it('POSTs to /read-all and unwraps the updated count', async () => {
    api.post.mockResolvedValue({ data: { data: { updated: 5 } } });
    const updated = await markAllNotificationsRead();
    expect(api.post).toHaveBeenCalledWith('/notifications/read-all');
    expect(updated).toBe(5);
  });
});

describe('deleteNotification', () => {
  it('DELETEs the notification', async () => {
    api.delete.mockResolvedValue({ data: { data: null } });
    await deleteNotification('n1');
    expect(api.delete).toHaveBeenCalledWith('/notifications/n1');
  });
});
