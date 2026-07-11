/**
 * Approval controller — thin HTTP glue over the approval service.
 */
import * as approvalService from './approval.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { approvals, meta } = await approvalService.listApprovals(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { approvals }, 'Approval requests retrieved', meta);
});

export const getById = asyncHandler(async (req, res) => {
  const approval = await approvalService.getApprovalById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { approval }, 'Approval request retrieved');
});

export const request = asyncHandler(async (req, res) => {
  const approval = await approvalService.requestApproval(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { approval }, 'Approval requested');
});

export const decide = asyncHandler(async (req, res) => {
  const approval = await approvalService.submitDecision(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { approval }, 'Decision recorded');
});

export const cancel = asyncHandler(async (req, res) => {
  const approval = await approvalService.cancelApproval(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { approval }, 'Approval request cancelled');
});
