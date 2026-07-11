/**
 * Template rendering engine (Module 6). Pure functions — no I/O, no Mongoose —
 * so they are trivially unit-testable and reusable by document generation
 * (Module 7).
 *
 * Placeholder syntax is `{{ key }}` (whitespace around the key is ignored). A
 * key starts with a letter and may contain letters, digits, and underscores.
 */

// Global matcher for every placeholder occurrence in a body of content.
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Whether a supplied value should be treated as "present". */
function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Unique placeholder keys referenced in `content`, in first-seen order.
 * @param {string} content
 * @returns {string[]}
 */
export function extractPlaceholders(content) {
  if (typeof content !== 'string') return [];
  const keys = [];
  const seen = new Set();
  for (const match of content.matchAll(PLACEHOLDER_RE)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Render `content` by substituting `{{key}}` placeholders. Precedence for each
 * placeholder: a supplied value in `values`, else the declared variable's
 * `defaultValue`, else the placeholder is left intact (so an unfilled preview is
 * still legible).
 *
 * @param {string} content - template body with placeholders
 * @param {Array<{ key:string, required?:boolean, defaultValue?:string|null }>} variables
 * @param {Record<string, unknown>} [values] - supplied values keyed by variable key
 * @returns {{ content:string, missingRequired:string[], usedVariables:string[], unknownPlaceholders:string[] }}
 */
export function renderContent(content, variables = [], values = {}) {
  const body = typeof content === 'string' ? content : '';
  const declared = new Map(variables.map((variable) => [variable.key, variable]));

  const rendered = body.replace(PLACEHOLDER_RE, (whole, key) => {
    if (hasValue(values[key])) return String(values[key]);
    const variable = declared.get(key);
    if (variable && hasValue(variable.defaultValue)) return String(variable.defaultValue);
    return whole;
  });

  // Required declared variables with neither a supplied value nor a default.
  const missingRequired = variables
    .filter((variable) => variable.required && !hasValue(values[variable.key]) && !hasValue(variable.defaultValue))
    .map((variable) => variable.key);

  const placeholders = extractPlaceholders(body);
  const usedVariables = placeholders.filter((key) => declared.has(key));
  const unknownPlaceholders = placeholders.filter((key) => !declared.has(key));

  return { content: rendered, missingRequired, usedVariables, unknownPlaceholders };
}
