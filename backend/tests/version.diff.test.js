/**
 * Line-level diff engine (Module 12 · Task 2): pure LCS diff — no DB. Covers
 * additions, removals, unchanged runs, mixed edits, line numbering, and the
 * empty-text edge cases.
 */
import { diffLines } from '../src/features/versions/version.diff.js';

const types = (result) => result.changes.map((c) => c.type);
const texts = (result) => result.changes.map((c) => c.text);

describe('diffLines', () => {
  it('reports every line unchanged for identical text', () => {
    const res = diffLines('a\nb\nc', 'a\nb\nc');
    expect(types(res)).toEqual(['unchanged', 'unchanged', 'unchanged']);
    expect(res.stats).toEqual({ added: 0, removed: 0, unchanged: 3 });
  });

  it('detects an appended line', () => {
    const res = diffLines('a\nb', 'a\nb\nc');
    expect(types(res)).toEqual(['unchanged', 'unchanged', 'added']);
    expect(texts(res)).toEqual(['a', 'b', 'c']);
    expect(res.stats).toEqual({ added: 1, removed: 0, unchanged: 2 });
  });

  it('detects a removed line', () => {
    const res = diffLines('a\nb\nc', 'a\nc');
    expect(types(res)).toEqual(['unchanged', 'removed', 'unchanged']);
    expect(res.stats).toEqual({ added: 0, removed: 1, unchanged: 2 });
  });

  it('represents a changed line as a removal + an addition', () => {
    const res = diffLines('hello\nworld', 'hello\nthere');
    expect(types(res)).toEqual(['unchanged', 'removed', 'added']);
    expect(texts(res)).toEqual(['hello', 'world', 'there']);
    expect(res.stats).toEqual({ added: 1, removed: 1, unchanged: 1 });
  });

  it('assigns 1-based line numbers per side', () => {
    const res = diffLines('a\nb\nc', 'a\nc');
    // a(unchanged) → old 1 / new 1; b(removed) → old 2 / null; c(unchanged) → old 3 / new 2
    expect(res.changes).toEqual([
      { type: 'unchanged', text: 'a', oldLine: 1, newLine: 1 },
      { type: 'removed', text: 'b', oldLine: 2, newLine: null },
      { type: 'unchanged', text: 'c', oldLine: 3, newLine: 2 },
    ]);
  });

  it('treats empty text as no lines (all-added / all-removed)', () => {
    expect(diffLines('', '').changes).toEqual([]);
    expect(types(diffLines('', 'x\ny'))).toEqual(['added', 'added']);
    expect(types(diffLines('x\ny', ''))).toEqual(['removed', 'removed']);
  });
});
