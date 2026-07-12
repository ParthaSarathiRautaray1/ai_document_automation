import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import { requestAiAssist, listAiCompletions } from '@/features/ai/ai.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestAiAssist', () => {
  it('posts the payload and unwraps { completion, cached }', async () => {
    const payload = { operation: 'improve', input: 'make this better' };
    api.post.mockResolvedValue({
      data: { data: { completion: { id: 'c1', output: 'Better.' }, cached: false } },
    });

    const result = await requestAiAssist(payload);
    expect(api.post).toHaveBeenCalledWith('/ai/assist', payload);
    expect(result).toEqual({ completion: { id: 'c1', output: 'Better.' }, cached: false });
  });
});

describe('listAiCompletions', () => {
  it('unwraps completions + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { completions: [{ id: 'c1' }] }, meta: { page: 1, total: 1 } },
    });

    const result = await listAiCompletions({ operation: 'improve', q: '' });
    expect(api.get).toHaveBeenCalledWith('/ai/completions', { params: { operation: 'improve' } });
    expect(result).toEqual({ completions: [{ id: 'c1' }], meta: { page: 1, total: 1 } });
  });
});
