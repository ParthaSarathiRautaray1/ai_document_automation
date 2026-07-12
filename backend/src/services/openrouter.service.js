/**
 * OpenRouter service — low-level chat-completion calls to the OpenRouter API.
 *
 * Design notes (mirrors `services/email.service.js`):
 *  - Uses the native `fetch` (Node >= 20); no extra HTTP dependency.
 *  - When `OPENROUTER_API_KEY` is not configured, the call throws a clear
 *    operational error (`503 AI_NOT_CONFIGURED`) rather than attempting a
 *    network request. Unlike email — which can be skipped and logged — an AI
 *    suggestion has no useful fallback, so the caller surfaces the error.
 *  - A request timeout guards against a hung provider.
 *  - This is a cross-cutting provider client (not a feature slice); the AI
 *    feature (`features/ai/*`) builds prompts, caches results, and owns policy.
 */
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../config/constants.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Request a chat completion from OpenRouter.
 *
 * @param {object} args
 * @param {Array<{ role: 'system'|'user'|'assistant', content: string }>} args.messages
 * @param {string} args.model - the OpenRouter model id
 * @param {number} [args.maxTokens] - cap on generated tokens
 * @param {number} [args.temperature] - sampling temperature (default 0.3 — favour
 *   faithful edits over creative rewrites)
 * @returns {Promise<{ content: string, model: string, usage: object|null }>}
 * @throws {ApiError} 503 when unconfigured, 502 on a provider/parse failure
 */
export async function createChatCompletion({ messages, model, maxTokens, temperature = 0.3 }) {
  if (!env.OPENROUTER_API_KEY) {
    throw new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'The AI assistant is not configured', {
      code: 'AI_NOT_CONFIGURED',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        // OpenRouter attribution headers (optional but recommended).
        'HTTP-Referer': env.CLIENT_URL,
        'X-Title': env.EMAIL_FROM_NAME,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ApiError(HTTP_STATUS.BAD_GATEWAY, `AI provider error (${response.status})`, {
        code: 'AI_PROVIDER_ERROR',
        details: body ? body.slice(0, 500) : null,
      });
    }

    const data = await response.json().catch(() => ({}));
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'The AI provider returned no content', {
        code: 'AI_EMPTY_RESPONSE',
      });
    }

    return { content, model: data.model || model, usage: data.usage ?? null };
  } finally {
    clearTimeout(timeout);
  }
}
