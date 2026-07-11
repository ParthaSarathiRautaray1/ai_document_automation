/**
 * Email log routes (Module 9 — Email Service).
 *
 * The organization's transactional email log: list + detail (`email:read`) and a
 * retry for messages that failed or were skipped (`email:retry`). All routes are
 * tenant-scoped (resolved from `req.user.organization`); there is no cross-org
 * access. Delivering a document lives on the documents router
 * (`POST /documents/:id/send`), since that is where the resource is.
 * Order: authenticate → authorizePermission → validate → controller.
 */
import { Router } from 'express';
import * as emailController from './email.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { listEmailsQuerySchema, emailIdParamSchema } from './email.validation.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSIONS.EMAIL_READ),
  validate({ query: listEmailsQuerySchema }),
  emailController.list
);

router.get(
  '/:id',
  authorizePermission(PERMISSIONS.EMAIL_READ),
  validate({ params: emailIdParamSchema }),
  emailController.getById
);

router.post(
  '/:id/retry',
  authorizePermission(PERMISSIONS.EMAIL_RETRY),
  validate({ params: emailIdParamSchema }),
  emailController.retry
);

export default router;
