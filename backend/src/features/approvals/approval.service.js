/**
 * Approval service (Module 11 — Approval Workflow). Pure business logic (no req/res).
 *
 * Routes a document to one or more approvers and tracks their decisions. The
 * request's `status` is derived from the per-approver steps under a `policy`
 * (`all` = every approver must approve; `any` = one approval suffices); a single
 * rejection rejects the whole request. Every operation is confined to the actor's
 * organization (tenant isolation): a request — or a document/approver referenced
 * during a request — in another org is reported as "not found", never leaked.
 */
import ApprovalRequest from './approval.model.js';
import User from '../users/user.model.js';
import { getDocumentById } from '../documents/document.service.js';
import { notifyUsers, createNotification } from '../notifications/notification.service.js';
import ApiError from '../../utils/ApiError.js';
import { orgScope, requireOrganization, listResources } from '../../utils/query.js';
import {
  APPROVAL_STATUS,
  APPROVAL_POLICY,
  APPROVER_STATUS,
  APPROVAL_DECISION,
  NOTIFICATION_TYPE,
} from '../../config/constants.js';

/** Load an approval request scoped to the actor's org, or throw 404. */
async function loadApproval(actor, id) {
  const approval = await ApprovalRequest.findOne({ _id: id, ...orgScope(actor) });
  if (!approval) {
    throw ApiError.notFound('Approval request not found', { code: 'APPROVAL_NOT_FOUND' });
  }
  return approval;
}

/**
 * De-duplicate approver ids and verify every one is a user in the actor's org.
 * Throws 404 APPROVER_NOT_FOUND if any id is unknown/out of scope.
 * @returns {Promise<string[]>} the unique, validated approver ids
 */
async function resolveApprovers(actor, approverIds) {
  const unique = [...new Set(approverIds.map(String))];
  const found = await User.find({ _id: { $in: unique }, ...orgScope(actor) }).select('_id');
  if (found.length !== unique.length) {
    throw ApiError.notFound('One or more approvers were not found in your organization', {
      code: 'APPROVER_NOT_FOUND',
    });
  }
  return unique;
}

/**
 * Recompute a request's status from its approver steps under its policy, and set
 * `decidedAt` when it reaches a terminal state. Mutates the passed document.
 */
function applyDecisionOutcome(approval) {
  const steps = approval.approvers;
  const anyRejected = steps.some((s) => s.status === APPROVER_STATUS.REJECTED);
  const allApproved = steps.every((s) => s.status === APPROVER_STATUS.APPROVED);
  const anyApproved = steps.some((s) => s.status === APPROVER_STATUS.APPROVED);

  if (anyRejected) {
    approval.status = APPROVAL_STATUS.REJECTED;
  } else if (approval.policy === APPROVAL_POLICY.ANY ? anyApproved : allApproved) {
    approval.status = APPROVAL_STATUS.APPROVED;
  } else {
    approval.status = APPROVAL_STATUS.PENDING;
  }

  approval.decidedAt = approval.status === APPROVAL_STATUS.PENDING ? null : new Date();
}

/**
 * Route a document for approval. Verifies the document + approvers are in the
 * actor's org and that the document has no other pending request.
 * @param {object} actor
 * @param {{ documentId:string, approverIds:string[], policy?:string, note?:string }} data
 */
export async function requestApproval(actor, data) {
  requireOrganization(actor, 'request approval');

  // Tenant-scoped load (cross-org → 404 DOCUMENT_NOT_FOUND).
  const document = await getDocumentById(actor, data.documentId);

  const existing = await ApprovalRequest.findOne({
    document: document.id,
    status: APPROVAL_STATUS.PENDING,
    ...orgScope(actor),
  });
  if (existing) {
    throw ApiError.conflict('This document already has a pending approval request', {
      code: 'APPROVAL_ALREADY_PENDING',
    });
  }

  const approverIds = await resolveApprovers(actor, data.approverIds);

  const approval = new ApprovalRequest({
    organization: actor.organization,
    document: document.id,
    policy: data.policy ?? APPROVAL_POLICY.ALL,
    note: data.note ?? null,
    approvers: approverIds.map((user) => ({ user })),
    requestedBy: actor.id,
  });

  await approval.save();

  // Notify each approver (best-effort; also mirrored to email). A `document`
  // referenced here is already tenant-scoped by getDocumentById above.
  await notifyUsers(approverIds, {
    organization: actor.organization,
    type: NOTIFICATION_TYPE.APPROVAL_REQUESTED,
    title: 'A document needs your approval',
    body: data.note ?? null,
    link: `/documents/${document.id}`,
    data: { documentId: String(document.id), approvalId: String(approval.id) },
    actor: actor.id,
    email: true,
  });

  return approval.toJSON();
}

/**
 * List approval requests with pagination and optional filtering (status/policy/
 * document/approver). Scoped to the actor's org.
 */
export async function listApprovals(actor, { page, limit, sort, status, policy, documentId, approverId }) {
  return listResources(ApprovalRequest, 'approvals', {
    actor,
    page,
    limit,
    sort,
    filters: { status, policy, document: documentId, 'approvers.user': approverId },
  });
}

/** A single approval request by id, scoped to the actor's org. */
export async function getApprovalById(actor, id) {
  const approval = await loadApproval(actor, id);
  return approval.toJSON();
}

/**
 * Submit a decision on a request you are an approver on. The acting user must be a
 * pending approver of a pending request; their step is recorded and the request
 * status recomputed under its policy.
 * @param {object} actor
 * @param {string} id
 * @param {{ decision:string, comment?:string }} data
 */
export async function submitDecision(actor, id, { decision, comment }) {
  const approval = await loadApproval(actor, id);

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw ApiError.badRequest('This approval request is no longer pending', {
      code: 'APPROVAL_NOT_PENDING',
    });
  }

  const step = approval.approvers.find((s) => String(s.user) === String(actor.id));
  if (!step) {
    throw ApiError.forbidden('You are not an approver on this request', {
      code: 'NOT_AN_APPROVER',
    });
  }
  if (step.status !== APPROVER_STATUS.PENDING) {
    throw ApiError.badRequest('You have already decided on this request', {
      code: 'ALREADY_DECIDED',
    });
  }

  step.status =
    decision === APPROVAL_DECISION.APPROVE ? APPROVER_STATUS.APPROVED : APPROVER_STATUS.REJECTED;
  step.comment = comment ?? null;
  step.decidedAt = new Date();

  applyDecisionOutcome(approval);
  await approval.save();

  // When the request reaches a terminal decision, notify the requester (unless
  // they decided it themselves). Best-effort; also mirrored to email.
  const isTerminal =
    approval.status === APPROVAL_STATUS.APPROVED || approval.status === APPROVAL_STATUS.REJECTED;
  if (isTerminal && approval.requestedBy && String(approval.requestedBy) !== String(actor.id)) {
    const approved = approval.status === APPROVAL_STATUS.APPROVED;
    await createNotification({
      organization: approval.organization,
      recipient: approval.requestedBy,
      type: approved ? NOTIFICATION_TYPE.APPROVAL_APPROVED : NOTIFICATION_TYPE.APPROVAL_REJECTED,
      title: approved
        ? 'Your approval request was approved'
        : 'Your approval request was rejected',
      body: comment ?? null,
      link: `/documents/${approval.document}`,
      data: { documentId: String(approval.document), approvalId: String(approval.id) },
      actor: actor.id,
      email: true,
    });
  }

  return approval.toJSON();
}

/** Withdraw a pending approval request. */
export async function cancelApproval(actor, id) {
  const approval = await loadApproval(actor, id);

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw ApiError.badRequest('This approval request is no longer pending', {
      code: 'APPROVAL_NOT_PENDING',
    });
  }

  approval.status = APPROVAL_STATUS.CANCELLED;
  approval.decidedAt = new Date();
  await approval.save();
  return approval.toJSON();
}
