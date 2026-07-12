/**
 * AI assistant endpoints (Module 16): POST /ai/assist + GET /ai/completions.
 *
 * The OpenRouter provider is mocked so the suite stays hermetic (no network):
 * we assert the assist flow builds a prompt from the input, persists the
 * suggestion, reuses the per-org cache on a repeat request (no second provider
 * call), validates its input, enforces tenant isolation on the history, and
 * requires authentication + the `ai:assist` capability (every role has it).
 */
import { jest } from '@jest/globals';

const createChatCompletion = jest.fn();

jest.unstable_mockModule('../src/services/openrouter.service.js', () => ({
  createChatCompletion,
}));

const mongoose = (await import('mongoose')).default;
const request = (await import('supertest')).default;
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/features/users/user.model.js');
const { default: AiCompletion } = await import('../src/features/ai/ai.model.js');
const { signAccessToken } = await import('../src/utils/token.js');
const { ROLES, AI_OPERATION, AI_TONE } = await import('../src/config/constants.js');

const PREFIX = process.env.API_PREFIX || '/api/v1';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser({ role = ROLES.MEMBER, organization } = {}) {
  const org = organization || new mongoose.Types.ObjectId();
  const user = await User.create({
    firstName: 'Ai',
    lastName: 'User',
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Sup3rSecret',
    role,
    organization: org,
  });
  return { user, token: signAccessToken(user), org };
}

beforeEach(() => {
  createChatCompletion.mockReset();
  createChatCompletion.mockResolvedValue({ content: 'Revised text.', model: 'test-model' });
});

describe('POST /ai/assist', () => {
  it('generates a suggestion, persists it, and passes the input to the provider', async () => {
    const { token, org } = await makeUser();

    const res = await request(app)
      .post(`${PREFIX}/ai/assist`)
      .set(bearer(token))
      .send({ operation: AI_OPERATION.IMPROVE, input: 'make this better' });

    expect(res.status).toBe(200);
    expect(res.body.data.cached).toBe(false);
    expect(res.body.data.completion.output).toBe('Revised text.');
    expect(res.body.data.completion.operation).toBe(AI_OPERATION.IMPROVE);

    // Provider was called with messages carrying the input text.
    expect(createChatCompletion).toHaveBeenCalledTimes(1);
    const { messages } = createChatCompletion.mock.calls[0][0];
    expect(messages.at(-1).content).toContain('make this better');

    // Persisted in the caller's org.
    const stored = await AiCompletion.find({ organization: org });
    expect(stored).toHaveLength(1);
  });

  it('serves an identical repeat request from cache without calling the provider again', async () => {
    const { token } = await makeUser();
    const body = { operation: AI_OPERATION.SHORTEN, input: 'trim me down please' };

    const first = await request(app).post(`${PREFIX}/ai/assist`).set(bearer(token)).send(body);
    expect(first.body.data.cached).toBe(false);

    const second = await request(app).post(`${PREFIX}/ai/assist`).set(bearer(token)).send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.cached).toBe(true);
    expect(second.body.data.completion.output).toBe('Revised text.');

    // Only the first (cache-miss) request hit the provider.
    expect(createChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('treats a different operation on the same text as a cache miss', async () => {
    const { token } = await makeUser();
    await request(app)
      .post(`${PREFIX}/ai/assist`)
      .set(bearer(token))
      .send({ operation: AI_OPERATION.IMPROVE, input: 'same text' });
    await request(app)
      .post(`${PREFIX}/ai/assist`)
      .set(bearer(token))
      .send({ operation: AI_OPERATION.EXPAND, input: 'same text' });

    expect(createChatCompletion).toHaveBeenCalledTimes(2);
  });

  it('performs a change_tone request when a tone is supplied', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post(`${PREFIX}/ai/assist`)
      .set(bearer(token))
      .send({ operation: AI_OPERATION.CHANGE_TONE, input: 'pay now', tone: AI_TONE.FRIENDLY });

    expect(res.status).toBe(200);
    expect(res.body.data.completion.tone).toBe(AI_TONE.FRIENDLY);
    const { messages } = createChatCompletion.mock.calls[0][0];
    expect(messages.at(-1).content).toContain(AI_TONE.FRIENDLY);
  });

  it('rejects change_tone without a tone (422 validation error)', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post(`${PREFIX}/ai/assist`)
      .set(bearer(token))
      .send({ operation: AI_OPERATION.CHANGE_TONE, input: 'pay now' });
    expect(res.status).toBe(422);
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it('rejects an unknown operation and empty input (422)', async () => {
    const { token } = await makeUser();
    const bad = await request(app)
      .post(`${PREFIX}/ai/assist`)
      .set(bearer(token))
      .send({ operation: 'teleport', input: 'x' });
    expect(bad.status).toBe(422);

    const empty = await request(app)
      .post(`${PREFIX}/ai/assist`)
      .set(bearer(token))
      .send({ operation: AI_OPERATION.IMPROVE, input: '   ' });
    expect(empty.status).toBe(422);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app)
      .post(`${PREFIX}/ai/assist`)
      .send({ operation: AI_OPERATION.IMPROVE, input: 'hi' });
    expect(res.status).toBe(401);
  });
});

describe('GET /ai/completions', () => {
  it('returns the org history newest-first and filters by operation, tenant-scoped', async () => {
    const { token, org } = await makeUser();
    await AiCompletion.create({
      organization: org,
      operation: AI_OPERATION.IMPROVE,
      promptHash: 'h1',
      input: 'older',
      output: 'A',
    });
    await AiCompletion.create({
      organization: org,
      operation: AI_OPERATION.SUMMARIZE,
      promptHash: 'h2',
      input: 'newer',
      output: 'B',
    });
    // Another org — must NOT appear.
    await AiCompletion.create({
      organization: new mongoose.Types.ObjectId(),
      operation: AI_OPERATION.IMPROVE,
      promptHash: 'h3',
      input: 'foreign',
      output: 'C',
    });

    const all = await request(app).get(`${PREFIX}/ai/completions`).set(bearer(token));
    expect(all.status).toBe(200);
    expect(all.body.data.completions).toHaveLength(2);
    expect(all.body.data.completions[0].input).toBe('newer');

    const filtered = await request(app)
      .get(`${PREFIX}/ai/completions`)
      .query({ operation: AI_OPERATION.SUMMARIZE })
      .set(bearer(token));
    expect(filtered.body.data.completions).toHaveLength(1);
    expect(filtered.body.data.completions[0].operation).toBe(AI_OPERATION.SUMMARIZE);
  });

  it('404s a completion in another org (isolation)', async () => {
    const { token } = await makeUser();
    const foreign = await AiCompletion.create({
      organization: new mongoose.Types.ObjectId(),
      operation: AI_OPERATION.IMPROVE,
      promptHash: 'hx',
      input: 'foreign',
      output: 'C',
    });
    const res = await request(app)
      .get(`${PREFIX}/ai/completions/${foreign.id}`)
      .set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('AI_COMPLETION_NOT_FOUND');
  });
});
