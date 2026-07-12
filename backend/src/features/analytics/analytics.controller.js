/**
 * Analytics controller — thin HTTP glue over the analytics service (Module 15).
 * Read-only: the dashboard aggregates data other modules own; there is nothing
 * to create/update/delete here.
 */
import * as analyticsService from './analytics.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const summary = asyncHandler(async (req, res) => {
  const summaryData = await analyticsService.getSummary(req.user);
  ApiResponse.send(res, HTTP_STATUS.OK, { summary: summaryData }, 'Dashboard summary retrieved');
});

export const recent = asyncHandler(async (req, res) => {
  const { documents } = await analyticsService.getRecentDocuments(req.user, {
    limit: req.query.limit,
  });
  ApiResponse.send(res, HTTP_STATUS.OK, { documents }, 'Recent activity retrieved');
});
