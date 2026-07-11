/**
 * Template controller — thin HTTP glue over the template service.
 */
import * as templateService from './template.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { templates, meta } = await templateService.listTemplates(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { templates }, 'Templates retrieved', meta);
});

export const getById = asyncHandler(async (req, res) => {
  const template = await templateService.getTemplateById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { template }, 'Template retrieved');
});

export const create = asyncHandler(async (req, res) => {
  const template = await templateService.createTemplate(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { template }, 'Template created');
});

export const update = asyncHandler(async (req, res) => {
  const template = await templateService.updateTemplate(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { template }, 'Template updated');
});

export const remove = asyncHandler(async (req, res) => {
  await templateService.deleteTemplate(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, null, 'Template deleted');
});

export const render = asyncHandler(async (req, res) => {
  const result = await templateService.renderTemplate(req.user, req.params.id, req.body.values);
  ApiResponse.send(res, HTTP_STATUS.OK, { render: result }, 'Template rendered');
});
