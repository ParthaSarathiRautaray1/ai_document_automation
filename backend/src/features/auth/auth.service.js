/**
 * Authentication service — business logic for account creation, login, refresh
 * token rotation, and logout. Pure of HTTP concerns (no req/res).
 *
 * Token model (see utils/token.js and ADR-0007):
 *  - Each successful register/login/refresh issues a NEW access + refresh pair.
 *  - Only the HASH of the current refresh token is persisted (refreshTokenHash).
 *  - Refresh ROTATES the token: the presented one is validated against the
 *    stored hash, then replaced. A reused/old refresh token no longer matches.
 */
import crypto from 'node:crypto';
import User from '../users/user.model.js';
import ApiError from '../../utils/ApiError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  compareTokenHash,
} from '../../utils/token.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { USER_STATUS } from '../../config/constants.js';

/**
 * Sign a fresh access+refresh pair, persist the refresh hash, and return both.
 * @param {import('mongoose').Document} user
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
}

/**
 * Register a new user account.
 * @param {{ firstName:string, lastName:string, email:string, password:string }} input
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export async function register(input) {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', {
      code: 'EMAIL_TAKEN',
      details: [{ field: 'email', message: 'already registered' }],
    });
  }

  const user = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: input.password, // hashed by the model's pre-save hook
  });

  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user);
  return { user: user.toJSON(), ...tokens };
}

/**
 * Authenticate a user with email + password.
 * Generic error for unknown-email/wrong-password to prevent enumeration.
 * @param {{ email:string, password:string }} input
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export async function login(input) {
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user || !(await user.comparePassword(input.password))) {
    throw ApiError.unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  }
  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden('This account is suspended', { code: 'ACCOUNT_SUSPENDED' });
  }

  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user);
  return { user: user.toJSON(), ...tokens };
}

/**
 * Rotate a refresh token: validate it (signature + stored hash), then issue a
 * brand-new access+refresh pair and replace the stored hash.
 * @param {string} refreshToken
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export async function refresh(refreshToken) {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required', { code: 'NO_REFRESH_TOKEN' });
  }

  // Throws (mapped to 401) if signature/expiry invalid.
  const payload = verifyRefreshToken(refreshToken);

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user) {
    throw ApiError.unauthorized('User no longer exists', { code: 'USER_NOT_FOUND' });
  }
  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden('This account is suspended', { code: 'ACCOUNT_SUSPENDED' });
  }
  // The presented token must match the currently stored (latest) one.
  if (!compareTokenHash(refreshToken, user.refreshTokenHash)) {
    throw ApiError.unauthorized('Refresh token has been revoked', { code: 'REFRESH_REVOKED' });
  }

  const tokens = await issueTokens(user);
  return { user: user.toJSON(), ...tokens };
}

/**
 * Log out: revoke the stored refresh token for the given user. Idempotent —
 * safe to call even if already logged out.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function logout(userId) {
  if (!userId) return;
  await User.updateOne({ _id: userId }, { $set: { refreshTokenHash: null } });
}

/**
 * Begin a password reset. Generates a single-use token (only its hash is
 * stored), then emails the plaintext token to the user.
 *
 * Enumeration-safe: this never reveals whether the email exists. Callers should
 * always respond with the same generic message.
 *
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) {
    // No account — do nothing (and say nothing). Prevents email enumeration.
    return;
  }

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail(user, resetUrl);
  } catch (err) {
    // Roll back the token so a failed delivery doesn't leave a dangling,
    // unusable reset window on the account.
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save({ validateBeforeSave: false });
    logger.error(`[auth] password reset email failed for ${user.email}: ${err.message}`);
    throw ApiError.internal('Could not send the password reset email. Please try again later.', {
      code: 'EMAIL_SEND_FAILED',
    });
  }
}

/**
 * Complete a password reset using the emailed token. On success the password is
 * replaced, the reset token is consumed, and ALL existing sessions are revoked
 * (refresh hash cleared; access tokens are invalidated via passwordChangedAt).
 *
 * @param {string} rawToken - Plaintext token from the reset link.
 * @param {string} newPassword
 * @returns {Promise<{ user: object }>}
 */
export async function resetPassword(rawToken, newPassword) {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetToken +passwordResetExpires');

  if (!user) {
    throw ApiError.badRequest('This password reset link is invalid or has expired', {
      code: 'RESET_TOKEN_INVALID',
    });
  }

  // Assigning triggers the pre-save hook (bcrypt hash + passwordChangedAt).
  user.password = newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.refreshTokenHash = null; // revoke any active refresh session
  await user.save();

  return { user: user.toJSON() };
}
