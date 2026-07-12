/**
 * AiCompletion model (Module 16). Verifies required fields, the tone enum, JSON
 * shaping (drops __v, keeps id), and the nullable defaults.
 */
import mongoose from 'mongoose';
import AiCompletion from '../src/features/ai/ai.model.js';
import { AI_OPERATION, AI_TONE } from '../src/config/constants.js';

const makeArgs = (overrides = {}) => ({
  organization: new mongoose.Types.ObjectId(),
  operation: AI_OPERATION.IMPROVE,
  promptHash: 'abc123',
  input: 'Hello world',
  output: 'Hello, world!',
  ...overrides,
});

describe('AiCompletion model', () => {
  it('stores a completion with sensible defaults', async () => {
    const doc = await AiCompletion.create(makeArgs());
    expect(doc.operation).toBe(AI_OPERATION.IMPROVE);
    expect(doc.tone).toBeNull();
    expect(doc.model).toBeNull();
    expect(doc.createdBy).toBeNull();
  });

  it('requires organization, operation, promptHash, input, and output', async () => {
    await expect(AiCompletion.create({ input: 'x' })).rejects.toThrow();
  });

  it('accepts a valid tone but rejects an unknown one', async () => {
    const ok = await AiCompletion.create(makeArgs({ tone: AI_TONE.FRIENDLY }));
    expect(ok.tone).toBe(AI_TONE.FRIENDLY);
    await expect(AiCompletion.create(makeArgs({ tone: 'grumpy' }))).rejects.toThrow();
  });

  it('drops __v in JSON while keeping id', async () => {
    const doc = await AiCompletion.create(makeArgs());
    const json = doc.toJSON();
    expect(json.id).toBeDefined();
    expect(json.__v).toBeUndefined();
  });
});
