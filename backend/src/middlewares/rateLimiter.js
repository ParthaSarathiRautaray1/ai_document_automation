/**
 * Rate limiters. A generous global limiter protects the whole API; a stricter
 * `authLimiter` guards credential endpoints (login/register/forgot-password)
 * against brute-force and enumeration attempts.
 */
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const windowMs = env.RATE_LIMIT_WINDOW_MIN * 60 * 1000;

const handler = (_req, _res, next) =>
  next(ApiError.tooManyRequests('Too many requests, please try again later.'));

export const globalLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: () => env.isTest,
});

export const authLimiter = rateLimit({
  windowMs,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: () => env.isTest,
});
