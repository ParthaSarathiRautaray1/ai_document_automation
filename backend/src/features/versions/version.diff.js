/**
 * Pure line-level diff engine (Module 12 — Version History).
 *
 * Computes the changes between two texts using a classic longest-common-
 * subsequence (LCS) walk over their lines. Returns an ordered list of change
 * entries (added / removed / unchanged) with 1-based line numbers on each side,
 * plus summary counts. No I/O — reused by the version service and unit-tested in
 * isolation (mirrors the pure-module pattern of template.engine.js / pdf.html.js).
 */

/** Split text into lines. Empty text has no lines (not one empty line). */
function splitLines(text) {
  const str = text == null ? '' : String(text);
  return str === '' ? [] : str.split('\n');
}

/**
 * Diff two texts line by line.
 * @param {string} oldText
 * @param {string} newText
 * @returns {{ changes: Array<{type:'added'|'removed'|'unchanged', text:string, oldLine:number|null, newLine:number|null}>, stats:{added:number, removed:number, unchanged:number} }}
 */
export function diffLines(oldText = '', newText = '') {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const m = a.length;
  const n = b.length;

  // lcs[i][j] = length of the LCS of a[i..] and b[j..].
  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const changes = [];
  let i = 0;
  let j = 0;
  let oldLine = 0;
  let newLine = 0;

  const push = (type, text, withOld, withNew) => {
    changes.push({
      type,
      text,
      oldLine: withOld ? (oldLine += 1) : null,
      newLine: withNew ? (newLine += 1) : null,
    });
  };

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push('unchanged', a[i], true, true);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('removed', a[i], true, false);
      i += 1;
    } else {
      push('added', b[j], false, true);
      j += 1;
    }
  }
  while (i < m) {
    push('removed', a[i], true, false);
    i += 1;
  }
  while (j < n) {
    push('added', b[j], false, true);
    j += 1;
  }

  const added = changes.filter((c) => c.type === 'added').length;
  const removed = changes.filter((c) => c.type === 'removed').length;
  return {
    changes,
    stats: { added, removed, unchanged: changes.length - added - removed },
  };
}

export default diffLines;
