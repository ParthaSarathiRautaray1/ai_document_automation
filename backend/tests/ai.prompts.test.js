/**
 * AI prompt builder & cache-key hashing (Module 16 · pure unit).
 *
 * `ai.prompts.js` has no I/O, so it is tested directly: the messages carry the
 * operation instruction + input, `change_tone` injects the tone, and the cache
 * key is stable for identical inputs but varies with every determining field.
 */
import { buildMessages, hashCompletion, AI_OPERATION_META } from '../src/features/ai/ai.prompts.js';
import { AI_OPERATION } from '../src/config/constants.js';

describe('buildMessages', () => {
  it('returns a system + user message carrying the instruction and input', () => {
    const messages = buildMessages(AI_OPERATION.IMPROVE, 'Hello world');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain(AI_OPERATION_META[AI_OPERATION.IMPROVE].instruction);
    expect(messages[1].content).toContain('Hello world');
  });

  it('injects the requested tone for change_tone', () => {
    const messages = buildMessages(AI_OPERATION.CHANGE_TONE, 'Pay now.', { tone: 'friendly' });
    expect(messages[1].content).toContain('friendly');
    expect(messages[1].content).not.toContain('{tone}');
  });

  it('throws for an unknown operation', () => {
    expect(() => buildMessages('teleport', 'x')).toThrow(/Unknown AI operation/);
  });
});

describe('hashCompletion', () => {
  const base = { model: 'm1', operation: AI_OPERATION.IMPROVE, tone: null, input: 'Hello' };

  it('is stable for identical inputs and ignores surrounding whitespace', () => {
    expect(hashCompletion(base)).toBe(hashCompletion({ ...base, input: '  Hello  ' }));
  });

  it('differs by operation, tone, input, and model', () => {
    const h = hashCompletion(base);
    expect(hashCompletion({ ...base, operation: AI_OPERATION.SHORTEN })).not.toBe(h);
    expect(hashCompletion({ ...base, tone: 'formal' })).not.toBe(h);
    expect(hashCompletion({ ...base, input: 'Goodbye' })).not.toBe(h);
    expect(hashCompletion({ ...base, model: 'm2' })).not.toBe(h);
  });
});
