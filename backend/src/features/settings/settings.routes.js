/**
 * Settings routes (Module 17).
 *
 *  - `/settings/me*` operate on the caller's own account and are gated by
 *    authentication alone (a user always manages their own settings — mirrors
 *    `/auth/me`). No permission is required.
 *  - `/settings/organization` operates on the caller's own tenant and reuses the
 *    Module 3 `org:read` / `org:update` permissions (admin+).
 *
 * Order: authenticate → (authorizePermission) → validate → controller.
 */
import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  updateMySettingsSchema,
  changePasswordSchema,
  updateOrgSettingsSchema,
} from './settings.validation.js';

const router = Router();

router.get('/me', authenticate, settingsController.getMine);

router.patch(
  '/me',
  authenticate,
  validate({ body: updateMySettingsSchema }),
  settingsController.updateMine
);

router.post(
  '/me/password',
  authenticate,
  validate({ body: changePasswordSchema }),
  settingsController.changePassword
);

router.get(
  '/organization',
  authenticate,
  authorizePermission(PERMISSIONS.ORG_READ),
  settingsController.getOrganization
);

router.patch(
  '/organization',
  authenticate,
  authorizePermission(PERMISSIONS.ORG_UPDATE),
  validate({ body: updateOrgSettingsSchema }),
  settingsController.updateOrganization
);

export default router;
