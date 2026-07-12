/**
 * OpenRouter provider (Module 16 · low-level client).
 *
 * The test environment has no `OPENROUTER_API_KEY`, so the client must refuse to
 * make a network call and instead throw a clear `503 AI_NOT_CONFIGURED` — the
 * hermetic guard that keeps the suite offline (mirrors email's graceful skip,
 * but AI has no useful fallback so it surfaces the error).
 */
import { createChatCompletion } from '../src/services/openrouter.service.js';

describe('createChatCompletion (unconfigured)', () => {
  it('throws 503 AI_NOT_CONFIGURED when no API key is set (no network call)', async () => {
    await expect(
      createChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'test-model',
        maxTokens: 100,
      })
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_NOT_CONFIGURED' });
  });
});
