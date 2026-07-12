/**
 * Settings controller — thin HTTP glue over the settings service.
 */
import * as settingsService from './settings.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const getMine = asyncHandler(async (req, res) => {
  const { user } = await settingsService.getMySettings(req.user);
  ApiResponse.send(res, HTTP_STATUS.OK, { user }, 'Settings retrieved');
});

export const updateMine = asyncHandler(async (req, res) => {
  const { user } = await settingsService.updateMySettings(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { user }, 'Settings updated');
});

export const changePassword = asyncHandler(async (req, res) => {
  await settingsService.changeMyPassword(req.user, req.body);
  // All sessions were revoked as part of the change; require a fresh login.
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    null,
    'Your password has been changed. Please log in again with your new password.'
  );
});

export const getOrganization = asyncHandler(async (req, res) => {
  const { settings } = await settingsService.getOrgSettings(req.user);
  ApiResponse.send(res, HTTP_STATUS.OK, { settings }, 'Organization settings retrieved');
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const { settings } = await settingsService.updateOrgSettings(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { settings }, 'Organization settings updated');
});
