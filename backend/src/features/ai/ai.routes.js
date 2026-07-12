/**
 * AI assistant routes (Module 16 — AI Assistant).
 *
 * All endpoints require authentication and the `ai:assist` capability (granted
 * to every role — assistive/read-like). Order: authenticate → authorizePermission
 * → validate → controller.
 *
 *   POST /ai/assist            → generate a text suggestion (cache-aware)
 *   GET  /ai/completions       → recent AI suggestions (history, paginated)
 *   GET  /ai/completions/:id   → a single stored suggestion
 */
import { Router } from 'express';
import * as aiController from './ai.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  assistSchema,
  listCompletionsQuerySchema,
  completionIdParamSchema,
} from './ai.validation.js';

const router = Router();

router.use(authenticate);
router.use(authorizePermission(PERMISSIONS.AI_ASSIST));

router.post('/assist', validate({ body: assistSchema }), aiController.assist);

router.get(
  '/completions',
  validate({ query: listCompletionsQuerySchema }),
  aiController.listCompletions
);

router.get(
  '/completions/:id',
  validate({ params: completionIdParamSchema }),
  aiController.getCompletion
);

export default router;
