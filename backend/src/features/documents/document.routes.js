/**
 * Generated document routes (Module 7 — Document Generation).
 *
 * All routes are tenant-scoped (resolved from `req.user.organization`); there is
 * no cross-org access. Order: authenticate → authorizePermission → validate →
 * controller. Generating a document creates it (`document:create`); regenerating
 * re-renders an existing one (`document:update`). Exporting to PDF
 * (`GET /:id/pdf`, Module 8) is a read-like capability (`document:export`).
 */
import { Router } from 'express';
import * as documentController from './document.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listDocumentsQuerySchema,
  documentIdParamSchema,
  generateDocumentSchema,
  regenerateDocumentSchema,
  updateDocumentSchema,
} from './document.validation.js';
import { sendDocumentSchema } from '../emails/email.validation.js';
import versionRoutes from '../versions/version.routes.js';

const router = Router();

// Every document route requires authentication.
router.use(authenticate);

// Version history is nested under a document (Module 12): /:id/versions/*.
router.use('/:id/versions', versionRoutes);

router.get(
  '/',
  authorizePermission(PERMISSIONS.DOCUMENT_READ),
  validate({ query: listDocumentsQuerySchema }),
  documentController.list
);

router.post(
  '/generate',
  authorizePermission(PERMISSIONS.DOCUMENT_CREATE),
  validate({ body: generateDocumentSchema }),
  documentController.generate
);

router.get(
  '/:id',
  authorizePermission(PERMISSIONS.DOCUMENT_READ),
  validate({ params: documentIdParamSchema }),
  documentController.getById
);

router.get(
  '/:id/pdf',
  authorizePermission(PERMISSIONS.DOCUMENT_EXPORT),
  validate({ params: documentIdParamSchema }),
  documentController.exportPdf
);

// Deliver the document to a recipient by email (Module 9).
router.post(
  '/:id/send',
  authorizePermission(PERMISSIONS.DOCUMENT_SEND),
  validate({ params: documentIdParamSchema, body: sendDocumentSchema }),
  documentController.send
);

router.patch(
  '/:id',
  authorizePermission(PERMISSIONS.DOCUMENT_UPDATE),
  validate({ params: documentIdParamSchema, body: updateDocumentSchema }),
  documentController.update
);

router.post(
  '/:id/regenerate',
  authorizePermission(PERMISSIONS.DOCUMENT_UPDATE),
  validate({ params: documentIdParamSchema, body: regenerateDocumentSchema }),
  documentController.regenerate
);

router.delete(
  '/:id',
  authorizePermission(PERMISSIONS.DOCUMENT_DELETE),
  validate({ params: documentIdParamSchema }),
  documentController.remove
);

export default router;
