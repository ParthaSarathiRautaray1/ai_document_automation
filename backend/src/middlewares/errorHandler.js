/**
 * Global error handler - the single place where all errors become HTTP
 * responses. Normalizes known error types (ApiError, Mongoose, JWT, Zod) into
 * the standard error envelope and hides internal details in production.
 *
 * Envelope: { success: false, message, code?, details?, stack? }
 */
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../config/constants.js';
import env from '../config/env.js';
import logger from '../config/logger.js';

function normalize(err) {
  if (err instanceof ApiError) return err;

  // Zod validation errors -> 422 with field details
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details,
    });
  }

  // Mongoose validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details,
    });
  }

  // Invalid ObjectId / cast error
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`, { code: 'CAST_ERROR' });
  }

  // Body-parser failures (http-errors). Malformed JSON and oversized bodies
  // arrive here as SyntaxError / http-errors with a client 4xx status; without
  // this they would fall through to a misleading generic 500.
  if (err && err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON in request body', { code: 'INVALID_JSON' });
  }
  if (err && err.type === 'entity.too.large') {
    return new ApiError(HTTP_STATUS.PAYLOAD_TOO_LARGE, 'Request body is too large', {
      code: 'PAYLOAD_TOO_LARGE',
    });
  }
  // Any other exposed http-errors carrying a 4xx status (e.g. bad content-type).
  if (err && typeof err.status === 'number' && err.status >= 400 && err.status < 500 && err.expose) {
    return new ApiError(err.status, err.message, { code: 'BAD_REQUEST' });
  }

  // Duplicate key (unique index violation)
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists`, {
      code: 'DUPLICATE_KEY',
      details: [{ field, message: 'must be unique' }],
    });
  }

  // JWT errors
  if (err instanceof jwt.TokenExpiredError) {
    return ApiError.unauthorized('Token has expired', { code: 'TOKEN_EXPIRED' });
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return ApiError.unauthorized('Invalid token', { code: 'TOKEN_INVALID' });
  }

  // Unknown / programmer error -> generic 500 (details hidden below)
  const wrapped = ApiError.internal(err.message || 'Internal server error');
  wrapped.isOperational = false;
  wrapped.stack = err.stack;
  return wrapped;
}

export default function errorHandler(err, req, res, _next) {
  const error = normalize(err);

  if (!error.isOperational || error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.statusCode}: ${error.message}`);
    if (error.stack) logger.error(error.stack);
  }

  const body = {
    success: false,
    message:
      error.isOperational || env.isProduction === false
        ? error.message
        : 'Internal server error',
  };
  if (error.code) body.code = error.code;
  if (error.details) body.details = error.details;
  if (!env.isProduction && error.stack) body.stack = error.stack;

  res.status(error.statusCode).json(body);
}
