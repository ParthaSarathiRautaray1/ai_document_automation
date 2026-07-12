/**
 * AI assistant UI helpers (Module 16) — the operation and tone option lists the
 * assist panel renders, kept in sync with the backend `AI_OPERATION` / `AI_TONE`
 * enums. `change_tone` is the only operation that takes a tone.
 */
export const AI_OPERATIONS = [
  { value: 'improve', label: 'Improve writing' },
  { value: 'summarize', label: 'Summarize' },
  { value: 'shorten', label: 'Make shorter' },
  { value: 'expand', label: 'Expand' },
  { value: 'fix_grammar', label: 'Fix grammar & spelling' },
  { value: 'change_tone', label: 'Change tone' },
];

export const AI_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
  { value: 'persuasive', label: 'Persuasive' },
  { value: 'concise', label: 'Concise' },
];

/** Whether an operation requires a tone to be chosen. */
export const operationNeedsTone = (operation) => operation === 'change_tone';

/** Human label for an operation value (falls back to the raw value). */
export function operationLabel(value) {
  return AI_OPERATIONS.find((o) => o.value === value)?.label ?? value;
}
