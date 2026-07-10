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
import * as organizationService from '../organizations/organization.service.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ROLES, USER_STATUS } from '../../config/constants.js';

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
 * Load a user's organization as plain JSON (or null if they have none / it was
 * removed). Surfaced on the identity responses so the SPA knows the tenant.
 * @param {import('mongoose').Document} user
 * @returns {Promise<object | null>}
 */
export function organizationForUser(user) {
  return organizationService.getPublicById(user.organization);
}

/**
 * Register a new user account. Self-serve tenancy (Module 3): the registrant
 * creates and OWNS a brand-new organization and becomes its admin. Additional
 * users join an existing org by invitation instead of registering.
 *
 * @param {{ firstName:string, lastName:string, email:string, password:string, organizationName?:string }} input
 * @returns {Promise<{ user: object, organization: object, accessToken: string, refreshToken: string }>}
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

  // Create the tenant this user owns. There are no multi-document transactions
  // here (single-node Mongo), so on failure we roll back the orphaned user.
  const orgName = input.organizationName?.trim() || `${input.firstName}'s Organization`;
  let organization;
  try {
    organization = await organizationService.createForOwner({ name: orgName, ownerId: user._id });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  user.organization = organization._id;
  user.role = ROLES.ADMIN; // the org creator administers their own tenant
  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user);
  return { user: user.toJSON(), organization: organization.toJSON(), ...tokens };
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
  if (user.status === USER_STATUS.INVITED) {
    throw ApiError.forbidden('Please accept your invitation to activate your account', {
      code: 'ACCOUNT_INVITED',
    });
  }

  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user);
  const organization = await organizationForUser(user);
  return { user: user.toJSON(), organization, ...tokens };
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
  const organization = await organizationForUser(user);
  return { user: user.toJSON(), organization, ...tokens };
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

/**
 * Accept a member invitation: verify the emailed token, set the invitee's
 * password, flip their status to `active`, and log them in (issue a token pair).
 * The token reuses the reset-token fields; only `invited` accounts are eligible.
 *
 * @param {string} rawToken - Plaintext token from the invite link.
 * @param {string} newPassword
 * @param {{ firstName?: string, lastName?: string }} [profile] - optional name overrides
 * @returns {Promise<{ user: object, organization: object|null, accessToken: string, refreshToken: string }>}
 */
export async function acceptInvite(rawToken, newPassword, profile = {}) {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
    status: USER_STATUS.INVITED,
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw ApiError.badRequest('This invitation is invalid or has expired', {
      code: 'INVITE_INVALID',
    });
  }

  if (profile.firstName) user.firstName = profile.firstName;
  if (profile.lastName) user.lastName = profile.lastName;
  user.password = newPassword; // triggers hash + passwordChangedAt
  user.status = USER_STATUS.ACTIVE;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.lastLoginAt = new Date();

  const tokens = await issueTokens(user); // saves the user
  const organization = await organizationForUser(user);
  return { user: user.toJSON(), organization, ...tokens };
}
