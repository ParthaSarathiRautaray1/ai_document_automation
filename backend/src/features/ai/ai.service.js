/**
 * AI service (Module 16 — AI Assistant). Pure business logic (no req/res).
 *
 * Orchestrates an assistive text operation: it builds a prompt, consults the
 * per-org cache, calls the provider only on a miss, and stores the result. The
 * assistant is strictly explicit (invoked per request) and assistive (it revises
 * a supplied snippet — it never authors a whole document); caching bounds cost
 * (ADR-0010).
 *
 * Everything is tenant-scoped via {@link orgScope}; a completion can only be
 * created/read within the caller's own organization (`super_admin` is global for
 * reads, but `assist` needs a concrete org to attach the entry to).
 */
import AiCompletion from './ai.model.js';
import { createChatCompletion } from '../../services/openrouter.service.js';
import { buildMessages, hashCompletion } from './ai.prompts.js';
import { orgScope, listResources, requireOrganization } from '../../utils/query.js';
import ApiError from '../../utils/ApiError.js';
import env from '../../config/env.js';
import { AI_MAX_OUTPUT_TOKENS } from '../../config/constants.js';

/**
 * Run an assistive text operation and return the suggestion. Checks the org
 * cache first; on a hit returns the stored result without calling the provider.
 *
 * @param {object} actor - the authenticated user (org owner of the result)
 * @param {{ operation: string, input: string, tone?: string|null }} params
 * @returns {Promise<{ completion: object, cached: boolean }>}
 */
export async function assist(actor, { operation, input, tone = null }) {
  // A completion is org-scoped data — there must be an org to attach it to.
  requireOrganization(actor, 'use the AI assistant');

  const model = env.OPENROUTER_MODEL;
  const promptHash = hashCompletion({ model, operation, tone, input });

  // Cache lookup (scoped to the actor's org). Newest wins if duplicates exist.
  const existing = await AiCompletion.findOne({ ...orgScope(actor), promptHash }).sort('-createdAt');
  if (existing) {
    return { completion: existing.toJSON(), cached: true };
  }

  const messages = buildMessages(operation, input, { tone });
  const { content, model: usedModel } = await createChatCompletion({
    messages,
    model,
    maxTokens: AI_MAX_OUTPUT_TOKENS,
  });

  const completion = await AiCompletion.create({
    organization: actor.organization,
    operation,
    model: usedModel || model,
    promptHash,
    input,
    tone: tone ?? null,
    output: content,
    createdBy: actor.id ?? null,
  });

  return { completion: completion.toJSON(), cached: false };
}

/**
 * List AI completions (the recent-suggestions history) with pagination, an
 * optional `operation` filter, and free-text search over the input/output.
 * Scoped to the actor's org.
 */
export async function listCompletions(actor, { page, limit, sort, q, operation }) {
  return listResources(AiCompletion, 'completions', {
    actor,
    page,
    limit,
    sort,
    filters: { operation },
    q,
    searchFields: ['input', 'output'],
  });
}

/** A single AI completion by id, scoped to the actor's org. */
export async function getCompletionById(actor, id) {
  const completion = await AiCompletion.findOne({ _id: id, ...orgScope(actor) });
  if (!completion) {
    throw ApiError.notFound('AI completion not found', { code: 'AI_COMPLETION_NOT_FOUND' });
  }
  return completion.toJSON();
}
