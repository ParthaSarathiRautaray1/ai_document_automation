/**
 * Authentication controller — thin HTTP glue. Reads validated input, calls the
 * service, manages the refresh-token cookie, and sends a standard ApiResponse.
 *
 * The refresh token is delivered two ways for flexibility:
 *  - as an httpOnly cookie (browser SPAs — not readable by JS, mitigates XSS),
 *  - and in the JSON body (native/mobile/API clients).
 * The `/auth/refresh` and `/auth/logout` endpoints accept it from either place.
 */
import * as authService from './auth.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';
import env from '../../config/env.js';
import { verifyRefreshToken } from '../../utils/token.js';
import { permissionsForRole } from '../../config/permissions.js';

const REFRESH_COOKIE = 'refreshToken';

/** Permissions granted to a user's role, surfaced so the client can render
 *  permission-aware UI without re-implementing the policy. */
function permissionsFor(user) {
  return [...permissionsForRole(user?.role)];
}

/** Parse durations like "7d", "15m", "3600s", "24h" into milliseconds. */
function durationToMs(value) {
  const match = /^(\d+)\s*([smhd])$/.exec(String(value).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // sensible default: 7 days
  const n = Number(match[1]);
  const unit = { s: 1e3, m: 6e4, h: 3.6e6, d: 8.64e7 }[match[2]];
  return n * unit;
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'strict' : 'lax',
    path: `${env.API_PREFIX}/auth`,
    maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  // clearCookie must match the attributes the cookie was set with (minus maxAge).
  const { httpOnly, secure, sameSite, path } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, { httpOnly, secure, sameSite, path });
}

/** Read the refresh token from the cookie first, then the request body. */
function readRefreshToken(req) {
  return req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken || null;
}

export const register = asyncHandler(async (req, res) => {
  const { user, organization, accessToken, refreshToken } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  ApiResponse.send(
    res,
    HTTP_STATUS.CREATED,
    { user, organization, accessToken, refreshToken, permissions: permissionsFor(user) },
    'Account created successfully'
  );
});

export const login = asyncHandler(async (req, res) => {
  const { user, organization, accessToken, refreshToken } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    { user, organization, accessToken, refreshToken, permissions: permissionsFor(user) },
    'Logged in successfully'
  );
});

export const refresh = asyncHandler(async (req, res) => {
  const presented = readRefreshToken(req);
  const { user, organization, accessToken, refreshToken } = await authService.refresh(presented);
  setRefreshCookie(res, refreshToken);
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    { user, organization, accessToken, refreshToken, permissions: permissionsFor(user) },
    'Token refreshed'
  );
});

export const logout = asyncHandler(async (req, res) => {
  const presented = readRefreshToken(req);
  // Best-effort: derive the user from the token to revoke the stored hash.
  let userId = req.user?.id ?? null;
  if (!userId && presented) {
    try {
      userId = verifyRefreshToken(presented).sub;
    } catch {
      userId = null; // expired/invalid token — still clear the cookie below
    }
  }
  await authService.logout(userId);
  clearRefreshCookie(res);
  ApiResponse.send(res, HTTP_STATUS.OK, null, 'Logged out successfully');
});

export const me = asyncHandler(async (req, res) => {
  const organization = await authService.organizationForUser(req.user);
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    { user: req.user.toJSON(), organization, permissions: permissionsFor(req.user) },
    'Current user'
  );
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  // Always generic — never reveals whether the email is registered.
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    null,
    'If an account exists for that email, a password reset link has been sent'
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  // Sessions are revoked as part of the reset; require a fresh login.
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    null,
    'Your password has been reset. Please log in with your new password.'
  );
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const { user, organization, accessToken, refreshToken } = await authService.acceptInvite(
    req.body.token,
    req.body.password,
    { firstName: req.body.firstName, lastName: req.body.lastName }
  );
  setRefreshCookie(res, refreshToken);
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    { user, organization, accessToken, refreshToken, permissions: permissionsFor(user) },
    'Invitation accepted'
  );
});
