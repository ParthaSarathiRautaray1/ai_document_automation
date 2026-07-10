/**
 * ApiError - operational (expected) error carrying an HTTP status code.
 *
 * Distinguishes expected failures (validation, auth, not-found) from
 * programmer bugs. The global error handler uses `isOperational` to decide
 * whether to expose the message to clients or hide it behind a generic 500.
 */
import { HTTP_STATUS } from '../config/constants.js';

export default class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code.
   * @param {string} message - Human-readable message safe to return to clients.
   * @param {object} [options]
   * @param {Array}  [options.details] - Field-level error details (e.g. validation).
   * @param {string} [options.code] - Machine-readable error code.
   */
  constructor(statusCode, message, { details = null, code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, options);
  }

  static unauthorized(message = 'Unauthorized', options) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, options);
  }

  static forbidden(message = 'Forbidden', options) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, options);
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, options);
  }

  static conflict(message = 'Conflict', options) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, options);
  }

  static tooManyRequests(message = 'Too many requests', options) {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message, options);
  }

  static internal(message = 'Internal server error', options) {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, options);
  }
}
