/**
 * Audit controller — thin HTTP glue over the audit service. Read-only: audit
 * logs are append-only (written internally by other services), so there are no
 * create/update/delete endpoints.
 */
import * as auditService from './audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { auditLogs, meta } = await auditService.listAuditLogs(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { auditLogs }, 'Audit logs retrieved', meta);
});

export const get = asyncHandler(async (req, res) => {
  const auditLog = await auditService.getAuditLogById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { auditLog }, 'Audit log retrieved');
});
