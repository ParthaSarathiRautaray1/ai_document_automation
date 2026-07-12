import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn() },
}));

import { api } from '@/lib/api';
import { listAuditLogs, getAuditLog } from '@/features/audit/audit.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listAuditLogs', () => {
  it('unwraps auditLogs + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: {
        data: { auditLogs: [{ id: 'a1' }] },
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      },
    });
    const result = await listAuditLogs({ page: 1, entityType: 'document', action: undefined, q: '' });
    expect(api.get).toHaveBeenCalledWith('/audit-logs', {
      params: { page: 1, entityType: 'document' },
    });
    expect(result).toEqual({
      auditLogs: [{ id: 'a1' }],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });
});

describe('getAuditLog', () => {
  it('unwraps a single audit log entry', async () => {
    api.get.mockResolvedValue({ data: { data: { auditLog: { id: 'a1', action: 'document.generate' } } } });
    const log = await getAuditLog('a1');
    expect(api.get).toHaveBeenCalledWith('/audit-logs/a1');
    expect(log).toEqual({ id: 'a1', action: 'document.generate' });
  });
});
