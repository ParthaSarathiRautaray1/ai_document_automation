/**
 * ApprovalRequest model (Module 11 · Task 1): defaults, enums, required fields,
 * the "at least one approver" rule, and the single-pending-request-per-document
 * partial unique index.
 */
import mongoose from 'mongoose';
import ApprovalRequest from '../src/features/approvals/approval.model.js';
import {
  APPROVAL_STATUS,
  APPROVAL_POLICY,
  APPROVER_STATUS,
} from '../src/config/constants.js';

function base(overrides = {}) {
  return {
    organization: new mongoose.Types.ObjectId(),
    document: new mongoose.Types.ObjectId(),
    approvers: [{ user: new mongoose.Types.ObjectId() }],
    ...overrides,
  };
}

describe('ApprovalRequest model', () => {
  // The partial unique index must be built before the duplicate-pending test.
  beforeAll(async () => {
    await ApprovalRequest.init();
  });

  it('applies sensible defaults', async () => {
    const approval = await ApprovalRequest.create(base());
    expect(approval.status).toBe(APPROVAL_STATUS.PENDING);
    expect(approval.policy).toBe(APPROVAL_POLICY.ALL);
    expect(approval.note).toBeNull();
    expect(approval.decidedAt).toBeNull();
    expect(approval.approvers[0].status).toBe(APPROVER_STATUS.PENDING);
    expect(approval.approvers[0].comment).toBeNull();
    expect(approval.approvers[0].decidedAt).toBeNull();
  });

  it('requires organization and document', async () => {
    await expect(
      ApprovalRequest.create({ document: new mongoose.Types.ObjectId(), approvers: [{ user: new mongoose.Types.ObjectId() }] })
    ).rejects.toThrow(/Organization/);
    await expect(
      ApprovalRequest.create({ organization: new mongoose.Types.ObjectId(), approvers: [{ user: new mongoose.Types.ObjectId() }] })
    ).rejects.toThrow(/Document/);
  });

  it('requires at least one approver', async () => {
    await expect(ApprovalRequest.create(base({ approvers: [] }))).rejects.toThrow(/at least one approver/i);
  });

  it('rejects an unknown status/policy', async () => {
    await expect(ApprovalRequest.create(base({ status: 'exploded' }))).rejects.toThrow();
    await expect(ApprovalRequest.create(base({ policy: 'sometimes' }))).rejects.toThrow();
  });

  it('strips __v and exposes id in JSON', async () => {
    const approval = await ApprovalRequest.create(base());
    const json = approval.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBe(approval.id);
  });

  it('allows only one pending request per document (partial unique index)', async () => {
    const document = new mongoose.Types.ObjectId();
    const org = new mongoose.Types.ObjectId();
    await ApprovalRequest.create(base({ organization: org, document }));
    await expect(ApprovalRequest.create(base({ organization: org, document }))).rejects.toThrow();
  });

  it('permits a new pending request once the prior one is terminal', async () => {
    const document = new mongoose.Types.ObjectId();
    const org = new mongoose.Types.ObjectId();
    const first = await ApprovalRequest.create(base({ organization: org, document }));
    first.status = APPROVAL_STATUS.APPROVED;
    await first.save();
    // A second pending request is now allowed (the index only guards `pending`).
    await expect(ApprovalRequest.create(base({ organization: org, document }))).resolves.toBeDefined();
  });
});
