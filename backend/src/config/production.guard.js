/**
 * Production configuration guard (Module 18).
 *
 * The Zod schema in `env.js` proves a variable is *present and well-formed*; it
 * cannot tell that a secret is still the placeholder from `.env.example`, or
 * that CLIENT_URL points at localhost. Those pass validation but are unsafe in
 * production, so they are checked separately here and the process refuses to
 * boot.
 *
 * Pure (no I/O, no process access) so it can be unit-tested directly: it takes a
 * config object and returns the problems it found.
 */

/** Secrets shipped in `.env.example` — a live deployment must not use them. */
const PLACEHOLDER_PATTERNS = [/replace_with/i, /changeme/i, /your[-_]?secret/i, /^secret$/i];

/** Minimum entropy we insist on for a signing secret in production. */
const MIN_SECRET_LENGTH = 32;

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function isLocalhost(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
}

/**
 * Hard errors that must block startup in production.
 * @param {object} cfg - the validated env config
 * @returns {string[]} human-readable problems (empty = safe to boot)
 */
export function productionConfigErrors(cfg) {
  const errors = [];

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = cfg[key] ?? '';
    if (isPlaceholder(secret)) {
      errors.push(`${key} is still a placeholder — generate one with \`openssl rand -hex 64\`.`);
    } else if (secret.length < MIN_SECRET_LENGTH) {
      errors.push(`${key} must be at least ${MIN_SECRET_LENGTH} characters in production.`);
    }
  }

  if (
    cfg.JWT_ACCESS_SECRET &&
    cfg.JWT_ACCESS_SECRET === cfg.JWT_REFRESH_SECRET
  ) {
    errors.push(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ — a shared secret lets an access token be replayed as a refresh token.'
    );
  }

  if (isLocalhost(cfg.CLIENT_URL ?? '')) {
    errors.push(
      'CLIENT_URL points at localhost — set it to the deployed frontend origin (it is used for CORS and for links in outbound email).'
    );
  }

  return errors;
}

/**
 * Soft problems worth shouting about that should NOT block startup (the feature
 * degrades gracefully rather than breaking the app).
 * @param {object} cfg
 * @returns {string[]}
 */
export function productionConfigWarnings(cfg) {
  const warnings = [];

  if (!cfg.BREVO_API_KEY) {
    warnings.push(
      'BREVO_API_KEY is not set — every outbound email (password reset, invitations, document delivery) will be recorded as `skipped` and never delivered.'
    );
  }
  if (!cfg.OPENROUTER_API_KEY) {
    warnings.push(
      'OPENROUTER_API_KEY is not set — the AI assistant will respond 503 AI_NOT_CONFIGURED.'
    );
  }
  if (!cfg.IS_HTTPS) {
    warnings.push(
      'IS_HTTPS is false — the refresh-token cookie will not be marked `secure`. Set it once TLS terminates in front of the API.'
    );
  }

  return warnings;
}
