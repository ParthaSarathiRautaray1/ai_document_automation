import ApiError from '../utils/ApiError.js';

/**
 * Catch-all for unmatched routes. Forwards a 404 ApiError to the global
 * error handler so unknown paths get the same response shape as everything else.
 */
export default function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
