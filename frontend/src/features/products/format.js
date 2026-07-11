/**
 * Formatting helpers for catalog pricing (Module 5).
 */

/**
 * Format a numeric price in the given currency using the browser locale, e.g.
 * `formatPrice(19.99, 'USD')` → "$19.99". Falls back to a plain number if the
 * currency code is missing or unrecognized.
 * @param {number | null | undefined} amount
 * @param {string} [currency]
 * @returns {string}
 */
export function formatPrice(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(
      amount
    );
  } catch {
    return `${amount} ${currency ?? ''}`.trim();
  }
}
