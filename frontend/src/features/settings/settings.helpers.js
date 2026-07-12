/**
 * Presentation helpers for the Settings feature (Module 17). Option lists mirror
 * the backend enums (see backend/src/config/constants.js); labels are UI-only.
 */
import { applyTheme, resolveTheme } from '@/lib/theme';

const THEME_STORAGE_KEY = 'docflow-theme';

/**
 * Apply the user's saved theme preference to the document and persist it so it
 * survives reloads (shared with the header ThemeToggle's localStorage key).
 * `system` clears the override and follows the OS/browser preference.
 * @param {'light'|'dark'|'system'} theme
 */
export function applyThemePreference(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage failures (private mode) — theme still applies for the session
  }
  applyTheme(theme === 'system' ? resolveTheme() : theme);
}

/** Theme choices (must match backend THEME). */
export const THEME_OPTIONS = [
  { value: 'system', label: 'System (match device)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Date-format choices (value is the pattern stored on the profile/org). */
export const DATE_FORMAT_OPTIONS = [
  { value: 'MMM D, YYYY', label: 'Jul 12, 2026 (MMM D, YYYY)' },
  { value: 'YYYY-MM-DD', label: '2026-07-12 (YYYY-MM-DD)' },
  { value: 'MM/DD/YYYY', label: '07/12/2026 (MM/DD/YYYY)' },
  { value: 'DD/MM/YYYY', label: '12/07/2026 (DD/MM/YYYY)' },
];

/** Document-type choices (must match backend DOCUMENT_TYPE). */
export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote' },
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'letter', label: 'Letter' },
  { value: 'other', label: 'Other' },
];
