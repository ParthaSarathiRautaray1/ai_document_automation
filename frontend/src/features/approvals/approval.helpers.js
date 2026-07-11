/** Presentation helpers shared by the approvals list + the document panel. */

/** Map an approval/approver status to a Badge variant. */
export const STATUS_BADGE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'default',
};

/** e.g. "2 / 3 approved" — how many approver steps have approved. */
export function approverSummary(approval) {
  const steps = approval.approvers ?? [];
  const approved = steps.filter((s) => s.status === 'approved').length;
  return `${approved} / ${steps.length} approved`;
}
