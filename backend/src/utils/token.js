/**
 * JWT token utilities.
 *
 * Single place that knows how tokens are minted and read.
 *  - ACCESS tokens: short-lived (default 15m), sent as `Authorization: Bearer`.
 *  - REFRESH tokens: long-lived (default 7d), used only to obtain a new access
 *    token. Only a HASH of the current refresh token is stored on the user, so a
 *    database leak does not expose usable tokens. Rotation replaces the stored
 *    hash on every successful refresh.
 *
 * Access payload:  { sub, role, type: "access" }
 * Refresh payload: { sub, type: "refresh" }
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { TOKEN_TYPES } from '../config/constants.js';

/**
 * Sign a short-lived access token for a user document.
 * @param {{ _id: any, role: string }} user
 * @returns {string} signed JWT
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, type: TOKEN_TYPES.ACCESS },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

/**
 * Sign a long-lived refresh token for a user document.
 * @param {{ _id: any }} user
 * @returns {string} signed JWT
 */
export function signRefreshToken(user) {
  // `jti` (unique token id) guarantees each refresh token is distinct even when
  // two are minted within the same second — essential for rotation to work.
  return jwt.sign(
    { sub: user._id.toString(), type: TOKEN_TYPES.REFRESH, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Verify and decode an access token. Throws jwt errors mapped to 401 upstream.
 * @param {string} token
 * @returns {{ sub: string, role: string, type: string, iat: number, exp: number }}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

/**
 * Verify and decode a refresh token.
 * @param {string} token
 * @returns {{ sub: string, type: string, iat: number, exp: number }}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

/**
 * Deterministic SHA-256 hash used to store/compare refresh tokens without
 * keeping the raw value. `compareTokenHash` is a constant-time comparison.
 * @param {string} token
 * @returns {string} hex digest
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison of a raw token against a stored hash.
 * @param {string} token
 * @param {string} storedHash
 * @returns {boolean}
 */
export function compareTokenHash(token, storedHash) {
  if (!storedHash) return false;
  const candidate = Buffer.from(hashToken(token));
  const expected = Buffer.from(storedHash);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}
