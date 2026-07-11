/**
 * Email controller — thin HTTP glue over the email feature service.
 */
import * as emailService from './email.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { emails, meta } = await emailService.listEmails(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { emails }, 'Emails retrieved', meta);
});

export const getById = asyncHandler(async (req, res) => {
  const email = await emailService.getEmailById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { email }, 'Email retrieved');
});

export const retry = asyncHandler(async (req, res) => {
  const email = await emailService.retryEmail(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { email }, 'Email retried');
});
