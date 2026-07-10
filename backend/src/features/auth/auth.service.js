/**
 * Authentication service — business logic for account creation and login.
 *
 * Pure of HTTP concerns (no req/res). Returns plain data the controller wraps
 * in an ApiResponse. Throws ApiError for expected failures.
 *
 * Task 2 scope: register + login issuing an access token. Refresh-token
 * issuance/rotation is layered in during Task 3.
 */
import User from '../users/user.model.js';
import ApiError from '../../utils/ApiError.js';
import { signAccessToken } from '../../utils/token.js';
import { USER_STATUS } from '../../config/constants.js';

/**
 * Register a new user account.
 * @param {{ firstName:string, lastName:string, email:string, password:string }} input
 * @returns {Promise<{ user: object, accessToken: string }>}
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
  await user.save();

  const accessToken = signAccessToken(user);
  return { user: user.toJSON(), accessToken };
}

/**
 * Authenticate a user with email + password.
 * Uses a single generic error for "no such user" and "wrong password" to avoid
 * leaking which emails are registered.
 * @param {{ email:string, password:string }} input
 * @returns {Promise<{ user: object, accessToken: string }>}
 */
export async function login(input) {
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  }

  const passwordMatches = await user.comparePassword(input.password);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  }

  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden('This account is suspended', { code: 'ACCOUNT_SUSPENDED' });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken(user);
  return { user: user.toJSON(), accessToken };
}
