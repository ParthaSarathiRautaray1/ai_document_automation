/**
 * Analytics routes (Module 15 — Dashboard & Analytics).
 *
 * Read-only org-scoped rollups gated by the `analytics:read` capability (granted
 * to every role — the dashboard is the authenticated landing page). Order:
 * authenticate → authorizePermission → validate → controller.
 */
import { Router } from 'express';
import * as analyticsController from './analytics.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { recentActivityQuerySchema } from './analytics.validation.js';

const router = Router();

router.use(authenticate);
router.use(authorizePermission(PERMISSIONS.ANALYTICS_READ));

router.get('/summary', analyticsController.summary);

router.get('/recent', validate({ query: recentActivityQuerySchema }), analyticsController.recent);

export default router;
