/**
 * Notification routes (Module 13 — Notifications).
 *
 * Every route operates on the authenticated user's OWN notifications, so a
 * single self-scoped capability (`notification:read`, held by every role) gates
 * them all — the recipient scope in the service is the real authorization.
 * Order: authenticate → authorizePermission → validate → controller. Literal
 * paths are declared before `/:id` so they aren't captured as an id.
 */
import { Router } from 'express';
import * as notificationController from './notification.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notification.validation.js';

const router = Router();

// Every notification route requires authentication.
router.use(authenticate);
router.use(authorizePermission(PERMISSIONS.NOTIFICATION_READ));

router.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);

router.get('/unread-count', notificationController.unreadCount);

router.post('/read-all', notificationController.markAllRead);

router.patch(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  notificationController.markRead
);

router.delete(
  '/:id',
  validate({ params: notificationIdParamSchema }),
  notificationController.remove
);

export default router;
