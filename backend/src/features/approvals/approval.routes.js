/**
 * Approval workflow routes (Module 11 — Approval Workflow).
 *
 * All routes are tenant-scoped (resolved from `req.user.organization`); there is
 * no cross-org access. Order: authenticate → authorizePermission → validate →
 * controller. Requesting routes a document for approval (`approval:request`);
 * a designated approver records a decision (`approval:decide`); the requester/
 * admin can withdraw a pending request (`approval:cancel`).
 */
import { Router } from 'express';
import * as approvalController from './approval.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listApprovalsQuerySchema,
  approvalIdParamSchema,
  requestApprovalSchema,
  decideApprovalSchema,
} from './approval.validation.js';

const router = Router();

// Every approval route requires authentication.
router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSIONS.APPROVAL_READ),
  validate({ query: listApprovalsQuerySchema }),
  approvalController.list
);

router.post(
  '/',
  authorizePermission(PERMISSIONS.APPROVAL_REQUEST),
  validate({ body: requestApprovalSchema }),
  approvalController.request
);

router.get(
  '/:id',
  authorizePermission(PERMISSIONS.APPROVAL_READ),
  validate({ params: approvalIdParamSchema }),
  approvalController.getById
);

router.post(
  '/:id/decision',
  authorizePermission(PERMISSIONS.APPROVAL_DECIDE),
  validate({ params: approvalIdParamSchema, body: decideApprovalSchema }),
  approvalController.decide
);

router.post(
  '/:id/cancel',
  authorizePermission(PERMISSIONS.APPROVAL_CANCEL),
  validate({ params: approvalIdParamSchema }),
  approvalController.cancel
);

export default router;
