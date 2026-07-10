/**
 * Organization routes (Module 3).
 *
 * `/organizations/me` operates on the caller's own tenant (resolved from
 * `req.user.organization`) — there is no cross-org access here.
 * Order: authenticate → authorizePermission → validate → controller.
 */
import { Router } from 'express';
import * as organizationController from './organization.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { updateOrganizationSchema, inviteMemberSchema } from './organization.validation.js';
import { listUsersQuerySchema, userIdParamSchema } from '../users/user.validation.js';

const router = Router();

router.get(
  '/me',
  authenticate,
  authorizePermission(PERMISSIONS.ORG_READ),
  organizationController.getMine
);

router.get(
  '/members',
  authenticate,
  authorizePermission(PERMISSIONS.USER_READ),
  validate({ query: listUsersQuerySchema }),
  organizationController.listMembers
);

router.post(
  '/members/invite',
  authenticate,
  authorizePermission(PERMISSIONS.ORG_MANAGE_MEMBERS),
  validate({ body: inviteMemberSchema }),
  organizationController.inviteMember
);

router.delete(
  '/members/:id',
  authenticate,
  authorizePermission(PERMISSIONS.ORG_MANAGE_MEMBERS),
  validate({ params: userIdParamSchema }),
  organizationController.removeMember
);

router.patch(
  '/me',
  authenticate,
  authorizePermission(PERMISSIONS.ORG_UPDATE),
  validate({ body: updateOrganizationSchema }),
  organizationController.updateMine
);

export default router;
