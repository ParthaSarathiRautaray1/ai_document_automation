/**
 * Authentication controller — thin HTTP glue. Reads validated input, calls the
 * service, and sends a standard ApiResponse. No business logic here.
 */
import * as authService from './auth.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const register = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.register(req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { user, accessToken }, 'Account created successfully');
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.login(req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { user, accessToken }, 'Logged in successfully');
});
