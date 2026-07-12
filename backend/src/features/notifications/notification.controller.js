/**
 * Notification controller — thin HTTP glue over the notification service.
 * Every action operates on the authenticated user's OWN notifications.
 */
import * as notificationService from './notification.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { notifications, meta } = await notificationService.listNotifications(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { notifications }, 'Notifications retrieved', meta);
});

export const unreadCount = asyncHandler(async (req, res) => {
  const { unread } = await notificationService.getUnreadCount(req.user);
  ApiResponse.send(res, HTTP_STATUS.OK, { unread }, 'Unread count retrieved');
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { notification }, 'Notification marked read');
});

export const markAllRead = asyncHandler(async (req, res) => {
  const { updated } = await notificationService.markAllRead(req.user);
  ApiResponse.send(res, HTTP_STATUS.OK, { updated }, 'Notifications marked read');
});

export const remove = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, null, 'Notification deleted');
});
