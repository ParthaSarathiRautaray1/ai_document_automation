/**
 * User-administration routes (Module 2).
 *
 * All require authentication and the `user:read` permission (managers and up).
 * Order: authenticate → authorizePermission → validate → controller.
 *
 * Task 2: list, get-by-id (read).
 * Task 3: role & status mutation (write).
 */
import { Router } from 'express';
import * as userController from './user.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listUsersQuerySchema,
  userIdParamSchema,
  updateRoleSchema,
  updateStatusSchema,
} from './user.validation.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorizePermission(PERMISSIONS.USER_READ),
  validate({ query: listUsersQuerySchema }),
  userController.list
);

router.get(
  '/:id',
  authenticate,
  authorizePermission(PERMISSIONS.USER_READ),
  validate({ params: userIdParamSchema }),
  userController.getById
);

router.patch(
  '/:id/role',
  authenticate,
  authorizePermission(PERMISSIONS.USER_UPDATE_ROLE),
  validate({ params: userIdParamSchema, body: updateRoleSchema }),
  userController.updateRole
);

router.patch(
  '/:id/status',
  authenticate,
  authorizePermission(PERMISSIONS.USER_UPDATE_STATUS),
  validate({ params: userIdParamSchema, body: updateStatusSchema }),
  userController.updateStatus
);

export default router;
