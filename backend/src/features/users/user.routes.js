/**
 * User-administration routes (Module 2).
 *
 * All require authentication and the `user:read` permission (managers and up).
 * Order: authenticate → authorizePermission → validate → controller.
 *
 * Task 2: list, get-by-id (read).
 * Task 3 will add role/status mutation.
 */
import { Router } from 'express';
import * as userController from './user.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { listUsersQuerySchema, userIdParamSchema } from './user.validation.js';

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

export default router;
