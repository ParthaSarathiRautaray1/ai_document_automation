/**
 * Production configuration guard (Module 18 · Task 1). Pure — no env/process
 * access, so the rules are asserted directly.
 */
import {
  productionConfigErrors,
  productionConfigWarnings,
} from '../src/config/production.guard.js';

/** A config that should boot cleanly in production. */
const safeConfig = () => ({
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  CLIENT_URL: 'https://app.docflow.example',
  BREVO_API_KEY: 'xkeysib-real',
  OPENROUTER_API_KEY: 'sk-or-real',
  IS_HTTPS: true,
});

describe('productionConfigErrors()', () => {
  it('accepts a safe production config', () => {
    expect(productionConfigErrors(safeConfig())).toEqual([]);
  });

  it('rejects placeholder secrets from .env.example', () => {
    const errors = productionConfigErrors({
      ...safeConfig(),
      JWT_ACCESS_SECRET: 'replace_with_a_long_random_secret',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/JWT_ACCESS_SECRET is still a placeholder/);
  });

  it('rejects a short signing secret', () => {
    const errors = productionConfigErrors({ ...safeConfig(), JWT_REFRESH_SECRET: 'tooshort' });
    expect(errors[0]).toMatch(/JWT_REFRESH_SECRET must be at least 32/);
  });

  it('rejects reusing one secret for both tokens', () => {
    const shared = 'c'.repeat(64);
    const errors = productionConfigErrors({
      ...safeConfig(),
      JWT_ACCESS_SECRET: shared,
      JWT_REFRESH_SECRET: shared,
    });
    expect(errors.some((e) => /must differ/.test(e))).toBe(true);
  });

  it('rejects a localhost CLIENT_URL', () => {
    for (const url of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const errors = productionConfigErrors({ ...safeConfig(), CLIENT_URL: url });
      expect(errors.some((e) => /CLIENT_URL points at localhost/.test(e))).toBe(true);
    }
  });
});

describe('productionConfigWarnings()', () => {
  it('is silent when everything is configured', () => {
    expect(productionConfigWarnings(safeConfig())).toEqual([]);
  });

  it('warns (does not block) on a missing email provider', () => {
    const warnings = productionConfigWarnings({ ...safeConfig(), BREVO_API_KEY: '' });
    expect(warnings.some((w) => /BREVO_API_KEY is not set/.test(w))).toBe(true);
    // Degrades gracefully (sends are `skipped`), so it must not be a hard error.
    expect(productionConfigErrors({ ...safeConfig(), BREVO_API_KEY: '' })).toEqual([]);
  });

  it('warns on a missing AI key and on non-HTTPS', () => {
    const warnings = productionConfigWarnings({
      ...safeConfig(),
      OPENROUTER_API_KEY: '',
      IS_HTTPS: false,
    });
    expect(warnings.some((w) => /OPENROUTER_API_KEY/.test(w))).toBe(true);
    expect(warnings.some((w) => /IS_HTTPS/.test(w))).toBe(true);
  });
});
