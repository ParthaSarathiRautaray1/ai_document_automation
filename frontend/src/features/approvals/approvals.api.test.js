import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  listApprovals,
  getApproval,
  requestApproval,
  decideApproval,
  cancelApproval,
} from '@/features/approvals/approvals.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listApprovals', () => {
  it('unwraps approvals + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { approvals: [{ id: 'a1' }] }, meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    });
    const result = await listApprovals({ page: 1, status: '', documentId: undefined });
    expect(api.get).toHaveBeenCalledWith('/approvals', { params: { page: 1 } });
    expect(result).toEqual({ approvals: [{ id: 'a1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  });
});

describe('getApproval', () => {
  it('unwraps a single approval', async () => {
    api.get.mockResolvedValue({ data: { data: { approval: { id: 'a1', status: 'pending' } } } });
    const approval = await getApproval('a1');
    expect(api.get).toHaveBeenCalledWith('/approvals/a1');
    expect(approval).toEqual({ id: 'a1', status: 'pending' });
  });
});

describe('requestApproval', () => {
  it('POSTs the payload and unwraps the approval', async () => {
    api.post.mockResolvedValue({ data: { data: { approval: { id: 'a1', status: 'pending' } } } });
    const payload = { documentId: 'd1', approverIds: ['u1'], policy: 'all' };
    const approval = await requestApproval(payload);
    expect(api.post).toHaveBeenCalledWith('/approvals', payload);
    expect(approval).toEqual({ id: 'a1', status: 'pending' });
  });
});

describe('decideApproval', () => {
  it('POSTs to /decision and unwraps the approval', async () => {
    api.post.mockResolvedValue({ data: { data: { approval: { id: 'a1', status: 'approved' } } } });
    const approval = await decideApproval('a1', { decision: 'approve' });
    expect(api.post).toHaveBeenCalledWith('/approvals/a1/decision', { decision: 'approve' });
    expect(approval).toEqual({ id: 'a1', status: 'approved' });
  });
});

describe('cancelApproval', () => {
  it('POSTs to /cancel and unwraps the approval', async () => {
    api.post.mockResolvedValue({ data: { data: { approval: { id: 'a1', status: 'cancelled' } } } });
    const approval = await cancelApproval('a1');
    expect(api.post).toHaveBeenCalledWith('/approvals/a1/cancel');
    expect(approval).toEqual({ id: 'a1', status: 'cancelled' });
  });
});
