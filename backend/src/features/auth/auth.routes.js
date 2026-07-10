/**
 * Authentication routes.
 *
 * Credential endpoints are guarded by the stricter `authLimiter` to slow
 * brute-force / enumeration. Input is validated by Zod before controllers run.
 *
 * Task 2: register, login. refresh/logout/me (Task 3) and forgot/reset (Task 4)
 * are added to this router as those tasks ship.
 */
import { Router } from 'express';
import * as authController from './auth.controller.js';
import validate from '../../middlewares/validate.js';
import { authLimiter } from '../../middlewares/rateLimiter.js';
import { registerSchema, loginSchema } from './auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);

export default router;
