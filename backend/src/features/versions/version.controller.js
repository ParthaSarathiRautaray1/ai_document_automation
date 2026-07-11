/**
 * Version-history controller — thin HTTP glue over the version service.
 * Routes are nested under a document, so the parent document id is `req.params.id`.
 */
import * as versionService from './version.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { versions, meta } = await versionService.listVersions(req.user, req.params.id, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { versions }, 'Versions retrieved', meta);
});

export const diff = asyncHandler(async (req, res) => {
  const result = await versionService.diffVersions(req.user, req.params.id, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, result, 'Version diff computed');
});

export const getById = asyncHandler(async (req, res) => {
  const version = await versionService.getVersionById(req.user, req.params.id, req.params.versionId);
  ApiResponse.send(res, HTTP_STATUS.OK, { version }, 'Version retrieved');
});

export const restore = asyncHandler(async (req, res) => {
  const document = await versionService.restoreVersion(req.user, req.params.id, req.params.versionId);
  ApiResponse.send(res, HTTP_STATUS.OK, { document }, 'Version restored');
});
