/**
 * authenticate - protects routes by requiring a valid access token.
 *
 * Flow:
 *  1. Extract the Bearer token from the Authorization header.
 *  2. Verify signature/expiry (jwt errors -> 401 via global handler).
 *  3. Load the user; reject if missing or suspended.
 *  4. Reject tokens issued before the last password change (invalidates old
 *     sessions after a password reset).
 *  5. Attach the user document to `req.user` for downstream handlers.
 */
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/token.js';
import { TOKEN_TYPES, USER_STATUS } from '../config/constants.js';
import User from '../features/users/user.model.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentication required', { code: 'NO_TOKEN' });
  }

  const payload = verifyAccessToken(token);
  if (payload.type !== TOKEN_TYPES.ACCESS) {
    throw ApiError.unauthorized('Invalid token type', { code: 'TOKEN_INVALID' });
  }

  const user = await User.findById(payload.sub).select('+passwordChangedAt');
  if (!user) {
    throw ApiError.unauthorized('User no longer exists', { code: 'USER_NOT_FOUND' });
  }
  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden('This account is suspended', { code: 'ACCOUNT_SUSPENDED' });
  }
  if (user.passwordChangedAfter(payload.iat)) {
    throw ApiError.unauthorized('Password was changed; please log in again', {
      code: 'PASSWORD_CHANGED',
    });
  }

  req.user = user;
  req.auth = { userId: user.id, role: user.role };
  next();
});

export default authenticate;
