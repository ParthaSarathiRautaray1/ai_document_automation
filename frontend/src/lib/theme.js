/**
 * Minimal theme controller. Applies a `.dark` class on <html>, remembers the
 * choice in localStorage, and otherwise follows the OS preference.
 */
const STORAGE_KEY = 'docflow-theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function resolveTheme() {
  const stored = getStoredTheme();
  if (stored === 'light' || stored === 'dark') return stored;
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme !== 'dark');
}

export function initTheme() {
  applyTheme(resolveTheme());
}

export function toggleTheme() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore storage failures (private mode) — theme still applies for the session
  }
  applyTheme(next);
  return next;
}
