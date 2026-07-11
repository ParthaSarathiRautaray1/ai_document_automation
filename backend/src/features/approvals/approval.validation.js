/**
 * Zod schemas for the approval endpoints (Module 11).
 * Query values are coerced/normalized here so the service receives clean input.
 */
import { z } from 'zod';
import {
  APPROVAL_STATUS_VALUES,
  APPROVAL_POLICY_VALUES,
  APPROVAL_DECISION_VALUES,
} from '../../config/constants.js';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

export const approvalIdParamSchema = z.object({ id: objectId('approval id') }).strict();

// Route a document for approval: pick the document, its approvers, a policy, and
// an optional note. Approver ids are de-duplicated in the service.
export const requestApprovalSchema = z
  .object({
    documentId: objectId('document id'),
    approverIds: z
      .array(objectId('approver id'))
      .min(1, 'At least one approver is required')
      .max(20),
    policy: z.enum(APPROVAL_POLICY_VALUES).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

// Submit a decision (approve/reject) on a request you are an approver on.
export const decideApprovalSchema = z
  .object({
    decision: z.enum(APPROVAL_DECISION_VALUES),
    comment: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export const listApprovalsQuerySchema = listQuery({
  sort: sortParam(['-createdAt', 'createdAt', 'status', '-status']),
  status: z.enum(APPROVAL_STATUS_VALUES).optional(),
  policy: z.enum(APPROVAL_POLICY_VALUES).optional(),
  documentId: objectId('document id').optional(),
  approverId: objectId('approver id').optional(),
});
