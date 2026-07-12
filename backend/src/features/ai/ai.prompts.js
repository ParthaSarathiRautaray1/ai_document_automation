/**
 * AI prompt builder & cache-key hashing (Module 16 — AI Assistant).
 *
 * PURE module — no I/O, no model, no req/res — so it is trivially unit-testable
 * (like `template.engine.js`, `pdf.html.js`, and `version.diff.js`). Two jobs:
 *  1. `buildMessages` — turn a text operation (+ optional tone) and an input
 *     snippet into the chat messages sent to the model. The system prompt keeps
 *     the assistant strictly assistive: it revises the *supplied* text and
 *     returns only the result (it never authors a whole document).
 *  2. `hashCompletion` — a stable cache key over the inputs that determine the
 *     output, so identical requests within an org reuse a stored result.
 */
import { createHash } from 'node:crypto';
import { AI_OPERATION, AI_OPERATION_VALUES } from '../../config/constants.js';

/**
 * Per-operation metadata: a human `label` and the `instruction` injected into
 * the prompt. Keeping the instruction here (not in the service) keeps the
 * wording testable and in one place.
 */
export const AI_OPERATION_META = Object.freeze({
  [AI_OPERATION.IMPROVE]: {
    label: 'Improve writing',
    instruction:
      'Improve the clarity, flow, and professionalism of the text while preserving its meaning and any factual details.',
  },
  [AI_OPERATION.SUMMARIZE]: {
    label: 'Summarize',
    instruction: 'Write a concise summary of the text that captures its key points.',
  },
  [AI_OPERATION.SHORTEN]: {
    label: 'Make shorter',
    instruction: 'Make the text more concise without losing essential information.',
  },
  [AI_OPERATION.EXPAND]: {
    label: 'Expand',
    instruction:
      'Expand the text with relevant detail and elaboration while keeping the original meaning and intent.',
  },
  [AI_OPERATION.FIX_GRAMMAR]: {
    label: 'Fix grammar & spelling',
    instruction:
      'Correct only the grammar, spelling, and punctuation. Do not change the wording, tone, or meaning beyond what is required to fix errors.',
  },
  [AI_OPERATION.CHANGE_TONE]: {
    label: 'Change tone',
    // `{tone}` is filled in by buildMessages.
    instruction: 'Rewrite the text in a {tone} tone while preserving its meaning.',
  },
});

const SYSTEM_PROMPT =
  'You are a writing assistant embedded in a business document tool. You help revise short passages of document text. Apply only the requested operation to the text the user provides. Return ONLY the revised text with no preamble, explanation, quotation marks, or commentary.';

/**
 * Build the chat messages for an operation over a piece of input text.
 *
 * @param {string} operation - an AI_OPERATION value
 * @param {string} input - the source text to operate on
 * @param {{ tone?: string|null }} [options] - required tone for `change_tone`
 * @returns {Array<{ role: 'system'|'user', content: string }>}
 * @throws {Error} for an unknown operation (validation should prevent this)
 */
export function buildMessages(operation, input, { tone = null } = {}) {
  const meta = AI_OPERATION_META[operation];
  if (!meta) {
    throw new Error(`Unknown AI operation: ${operation}`);
  }

  const instruction =
    operation === AI_OPERATION.CHANGE_TONE
      ? meta.instruction.replace('{tone}', tone || 'professional')
      : meta.instruction;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${instruction}\n\nText:\n${input}` },
  ];
}

/**
 * Deterministic cache key for a completion. Hashes exactly the inputs that
 * determine the output (model, operation, tone, and the normalized text), so a
 * repeated request maps to the same key and reuses the stored result.
 *
 * @param {{ model: string, operation: string, tone?: string|null, input: string }} args
 * @returns {string} a hex SHA-256 digest
 */
export function hashCompletion({ model, operation, tone = null, input }) {
  const payload = JSON.stringify({
    model,
    operation,
    tone: tone || null,
    input: String(input).trim(),
  });
  return createHash('sha256').update(payload).digest('hex');
}

/** The set of valid operations (re-exported for convenience). */
export { AI_OPERATION_VALUES };
