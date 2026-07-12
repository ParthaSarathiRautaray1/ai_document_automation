/**
 * AI controller — thin HTTP glue over the AI service (Module 16).
 */
import * as aiService from './ai.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const assist = asyncHandler(async (req, res) => {
  const { completion, cached } = await aiService.assist(req.user, req.body);
  ApiResponse.send(
    res,
    HTTP_STATUS.OK,
    { completion, cached },
    cached ? 'AI suggestion retrieved from cache' : 'AI suggestion generated'
  );
});

export const listCompletions = asyncHandler(async (req, res) => {
  const { completions, meta } = await aiService.listCompletions(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { completions }, 'AI history retrieved', meta);
});

export const getCompletion = asyncHandler(async (req, res) => {
  const completion = await aiService.getCompletionById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { completion }, 'AI completion retrieved');
});
