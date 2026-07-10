/**
 * asyncHandler - wraps an async Express route/middleware so rejected promises
 * are forwarded to `next()` instead of crashing the process. Removes the need
 * for a try/catch in every controller.
 *
 * @param {Function} fn - async (req, res, next) => {...}
 * @returns {Function} Express handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
