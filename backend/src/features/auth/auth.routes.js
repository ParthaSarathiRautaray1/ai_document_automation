/**
 * Authentication routes.
 *
 * Credential endpoints are guarded by the stricter `authLimiter`. `/auth/me`
 * requires a valid access token via the `authenticate` middleware.
 *
 * Task 2: register, login.
 * Task 3: refresh (rotation), logout, me (protected).
 * Task 4: forgot-password, reset-password.
 */
import { Router } from 'express';
import * as authController from './auth.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authLimiter } from '../../middlewares/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);
router.post(
  '/accept-invite',
  authLimiter,
  validate({ body: acceptInviteSchema }),
  authController.acceptInvite
);

export default router;
