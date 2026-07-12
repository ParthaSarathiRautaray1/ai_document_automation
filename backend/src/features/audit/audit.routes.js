/**
 * Audit routes (Module 14 — Audit Logs).
 *
 * Read-only, org-wide activity trail gated by the admin-level `audit:read`
 * capability. Order: authenticate → authorizePermission → validate → controller.
 * Literal paths would be declared before `/:id`; here there are none.
 */
import { Router } from 'express';
import * as auditController from './audit.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditLogIdParamSchema, listAuditLogsQuerySchema } from './audit.validation.js';

const router = Router();

router.use(authenticate);
router.use(authorizePermission(PERMISSIONS.AUDIT_READ));

router.get('/', validate({ query: listAuditLogsQuerySchema }), auditController.list);

router.get('/:id', validate({ params: auditLogIdParamSchema }), auditController.get);

export default router;
