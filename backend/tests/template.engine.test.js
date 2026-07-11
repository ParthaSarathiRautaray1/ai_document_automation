/**
 * Template rendering engine (Module 6 · Task 3): pure placeholder extraction and
 * value substitution — no DB. Covers precedence (value > default > untouched),
 * required-missing detection, and unknown/whitespace placeholders.
 */
import { extractPlaceholders, renderContent } from '../src/features/templates/template.engine.js';

describe('extractPlaceholders', () => {
  it('returns unique keys in first-seen order, ignoring surrounding whitespace', () => {
    expect(extractPlaceholders('Hi {{ name }}, order {{orderId}} for {{name}}')).toEqual([
      'name',
      'orderId',
    ]);
  });

  it('returns [] for content with no placeholders or non-string input', () => {
    expect(extractPlaceholders('nothing here')).toEqual([]);
    expect(extractPlaceholders(null)).toEqual([]);
  });
});

describe('renderContent', () => {
  const variables = [
    { key: 'name', required: true, defaultValue: null },
    { key: 'company', required: false, defaultValue: 'Acme Inc' },
  ];

  it('substitutes supplied values', () => {
    const out = renderContent('Dear {{name}} of {{company}}', variables, { name: 'Ada' });
    expect(out.content).toBe('Dear Ada of Acme Inc'); // company falls back to default
    expect(out.missingRequired).toEqual([]);
  });

  it('falls back to a declared default when no value is supplied', () => {
    const out = renderContent('{{company}}', variables, {});
    expect(out.content).toBe('Acme Inc');
  });

  it('leaves a placeholder intact when there is no value and no default', () => {
    const out = renderContent('Hello {{name}}', variables, {});
    expect(out.content).toBe('Hello {{name}}');
    expect(out.missingRequired).toEqual(['name']);
  });

  it('coerces number/boolean values to strings', () => {
    const out = renderContent('{{qty}} / {{active}}', [], { qty: 5, active: true });
    expect(out.content).toBe('5 / true');
  });

  it('reports used and unknown placeholders', () => {
    const out = renderContent('{{name}} {{mystery}}', variables, { name: 'Ada' });
    expect(out.usedVariables).toEqual(['name']);
    expect(out.unknownPlaceholders).toEqual(['mystery']);
  });

  it('treats an empty-string supplied value as missing (uses default / stays required)', () => {
    const out = renderContent('{{name}} {{company}}', variables, { name: '', company: '' });
    expect(out.content).toBe('{{name}} Acme Inc');
    expect(out.missingRequired).toEqual(['name']);
  });
});
