/** Presentation helpers for the notifications page. */

/** Human label for each notification type. */
export const TYPE_LABEL = {
  approval_requested: 'Approval requested',
  approval_approved: 'Approval approved',
  approval_rejected: 'Approval rejected',
  system: 'System',
};

/** Map a notification type to a Badge variant. */
export const TYPE_BADGE = {
  approval_requested: 'warning',
  approval_approved: 'success',
  approval_rejected: 'destructive',
  system: 'default',
};

/** A compact, human-readable "time ago" label for a timestamp. */
export function timeAgo(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}
