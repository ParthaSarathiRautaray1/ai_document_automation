/**
 * Document template routes (Module 6 — Template Engine).
 *
 * All routes are tenant-scoped (resolved from `req.user.organization`); there is
 * no cross-org access. Order: authenticate → authorizePermission → validate →
 * controller. Rendering a preview is a read operation (`template:read`).
 */
import { Router } from 'express';
import * as templateController from './template.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listTemplatesQuerySchema,
  templateIdParamSchema,
  createTemplateSchema,
  updateTemplateSchema,
  renderTemplateSchema,
} from './template.validation.js';

const router = Router();

// Every template route requires authentication.
router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSIONS.TEMPLATE_READ),
  validate({ query: listTemplatesQuerySchema }),
  templateController.list
);

router.post(
  '/',
  authorizePermission(PERMISSIONS.TEMPLATE_CREATE),
  validate({ body: createTemplateSchema }),
  templateController.create
);

router.get(
  '/:id',
  authorizePermission(PERMISSIONS.TEMPLATE_READ),
  validate({ params: templateIdParamSchema }),
  templateController.getById
);

router.patch(
  '/:id',
  authorizePermission(PERMISSIONS.TEMPLATE_UPDATE),
  validate({ params: templateIdParamSchema, body: updateTemplateSchema }),
  templateController.update
);

router.delete(
  '/:id',
  authorizePermission(PERMISSIONS.TEMPLATE_DELETE),
  validate({ params: templateIdParamSchema }),
  templateController.remove
);

router.post(
  '/:id/render',
  authorizePermission(PERMISSIONS.TEMPLATE_READ),
  validate({ params: templateIdParamSchema, body: renderTemplateSchema }),
  templateController.render
);

export default router;
