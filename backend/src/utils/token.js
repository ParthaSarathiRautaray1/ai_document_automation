/**
 * JWT token utilities.
 *
 * Task 2 covers ACCESS tokens (short-lived, sent as Bearer). Refresh-token
 * signing/rotation is added in Task 3; this module is the single place that
 * knows how tokens are minted and read.
 *
 * The access token payload is intentionally minimal — just enough to identify
 * and authorize the principal without a DB hit for basic checks:
 *   { sub: <userId>, role: <role> }  (+ standard iat/exp)
 */
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { TOKEN_TYPES } from '../config/constants.js';

/**
 * Sign a short-lived access token for a user document.
 * @param {{ _id: any, role: string }} user
 * @returns {string} signed JWT
 */
export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, type: TOKEN_TYPES.ACCESS }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

/**
 * Verify and decode an access token. Throws jwt errors (TokenExpiredError /
 * JsonWebTokenError) which the global error handler maps to 401 responses.
 * @param {string} token
 * @returns {{ sub: string, role: string, type: string, iat: number, exp: number }}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}
