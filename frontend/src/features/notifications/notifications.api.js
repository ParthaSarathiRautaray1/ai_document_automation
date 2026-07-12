/**
 * Notification API calls (Module 13). Each returns the unwrapped payload from the
 * backend's `{ success, message, data, meta }` envelope. Every endpoint operates
 * on the current user's OWN notifications.
 *
 * Backend contracts:
 *  - GET    /notifications              → { notifications } + meta
 *  - GET    /notifications/unread-count → { unread }
 *  - PATCH  /notifications/:id/read     → { notification }
 *  - POST   /notifications/read-all     → { updated }
 *  - DELETE /notifications/:id          → null
 */
import { api, cleanParams } from '@/lib/api';

export async function listNotifications(params = {}) {
  const { data } = await api.get('/notifications', { params: cleanParams(params) });
  return { notifications: data.data.notifications, meta: data.meta };
}

export async function getUnreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.data.unread;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data.data.notification;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data.data.updated;
}

export async function deleteNotification(id) {
  await api.delete(`/notifications/${id}`);
}
