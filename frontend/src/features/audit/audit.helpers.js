/** Presentation helpers for the audit logs page. */

/** Human label for each known action string. Falls back to the raw action. */
export const ACTION_LABEL = {
  'document.generate': 'Generated document',
  'document.regenerate': 'Regenerated document',
  'document.update': 'Updated document',
  'document.delete': 'Deleted document',
  'approval.request': 'Requested approval',
  'approval.decide': 'Decided approval',
  'approval.cancel': 'Cancelled approval',
};

/** Map an entity type to a Badge variant. */
export const ENTITY_BADGE = {
  document: 'default',
  template: 'default',
  customer: 'default',
  product: 'default',
  approval: 'warning',
  email: 'default',
  user: 'default',
  organization: 'default',
};

/** The entity types offered in the filter dropdown. */
export const ENTITY_TYPES = [
  'document',
  'template',
  'customer',
  'product',
  'approval',
  'email',
  'user',
  'organization',
];

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
