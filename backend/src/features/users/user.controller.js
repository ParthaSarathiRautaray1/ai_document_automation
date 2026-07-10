/**
 * User-administration controller — thin HTTP glue over the user service.
 */
import * as userService from './user.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { users, meta } = await userService.listUsers(req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { users }, 'Users retrieved', meta);
});

export const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { user }, 'User retrieved');
});
