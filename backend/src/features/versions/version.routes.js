/**
 * Version-history routes (Module 12 — Version History).
 *
 * Nested under a document and mounted at `/documents/:id/versions` (see
 * document.routes.js), so `mergeParams` exposes the parent `:id`. Authentication
 * is applied by the parent document router; each route additionally checks a
 * permission. Viewing history + diffs is a read-like capability (`version:read`,
 * granted to everyone who can read a document); rolling back is `version:restore`.
 *
 * `/diff` is declared before `/:versionId` so the literal path is not captured as
 * a version id.
 */
import { Router } from 'express';
import * as versionController from './version.controller.js';
import validate from '../../middlewares/validate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  versionListParamsSchema,
  versionParamsSchema,
  listVersionsQuerySchema,
  diffVersionsQuerySchema,
} from './version.validation.js';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authorizePermission(PERMISSIONS.VERSION_READ),
  validate({ params: versionListParamsSchema, query: listVersionsQuerySchema }),
  versionController.list
);

router.get(
  '/diff',
  authorizePermission(PERMISSIONS.VERSION_READ),
  validate({ params: versionListParamsSchema, query: diffVersionsQuerySchema }),
  versionController.diff
);

router.get(
  '/:versionId',
  authorizePermission(PERMISSIONS.VERSION_READ),
  validate({ params: versionParamsSchema }),
  versionController.getById
);

router.post(
  '/:versionId/restore',
  authorizePermission(PERMISSIONS.VERSION_RESTORE),
  validate({ params: versionParamsSchema }),
  versionController.restore
);

export default router;
