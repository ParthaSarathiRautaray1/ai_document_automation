import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn() },
}));

import { api } from '@/lib/api';
import { getDashboardSummary, getRecentDocuments } from '@/features/dashboard/dashboard.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDashboardSummary', () => {
  it('unwraps the summary payload', async () => {
    const summary = {
      documents: { total: 3, byStatus: { draft: 2, final: 1, archived: 0 } },
      customers: { total: 1, byStatus: { active: 1, inactive: 0, archived: 0 } },
      products: { total: 0 },
      templates: { total: 0 },
      approvals: { pending: 2 },
    };
    api.get.mockResolvedValue({ data: { data: { summary } } });

    const result = await getDashboardSummary();
    expect(api.get).toHaveBeenCalledWith('/analytics/summary');
    expect(result).toEqual(summary);
  });
});

describe('getRecentDocuments', () => {
  it('unwraps documents and strips empty params', async () => {
    api.get.mockResolvedValue({ data: { data: { documents: [{ id: 'd1', title: 'Doc' }] } } });

    const result = await getRecentDocuments({ limit: 5 });
    expect(api.get).toHaveBeenCalledWith('/analytics/recent', { params: { limit: 5 } });
    expect(result).toEqual([{ id: 'd1', title: 'Doc' }]);
  });
});
