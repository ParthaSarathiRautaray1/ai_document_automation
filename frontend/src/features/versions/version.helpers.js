/** Presentation helpers for the version-history panel (Module 12). */

/** Map a version's changeType to a Badge variant. */
export const CHANGE_TYPE_BADGE = {
  generated: 'default',
  regenerated: 'default',
  edited: 'warning',
  restored: 'success',
};

/** Map a diff line type to a Tailwind class set for its row. */
export const DIFF_LINE_CLASS = {
  added: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  removed: 'bg-red-500/10 text-red-700 dark:text-red-300',
  unchanged: 'text-muted-foreground',
};

/** The gutter marker shown before a diff line. */
export const DIFF_LINE_MARKER = { added: '+', removed: '-', unchanged: ' ' };
