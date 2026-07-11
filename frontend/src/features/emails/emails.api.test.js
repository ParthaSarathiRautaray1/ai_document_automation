import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import { listEmails, getEmail, retryEmail } from '@/features/emails/emails.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listEmails', () => {
  it('unwraps emails + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { emails: [{ id: 'e1' }] }, meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    });
    const result = await listEmails({ page: 1, q: '', status: undefined });
    expect(api.get).toHaveBeenCalledWith('/emails', { params: { page: 1 } });
    expect(result).toEqual({ emails: [{ id: 'e1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  });
});

describe('getEmail', () => {
  it('unwraps a single email', async () => {
    api.get.mockResolvedValue({ data: { data: { email: { id: 'e1', subject: 'Invoice' } } } });
    const email = await getEmail('e1');
    expect(api.get).toHaveBeenCalledWith('/emails/e1');
    expect(email).toEqual({ id: 'e1', subject: 'Invoice' });
  });
});

describe('retryEmail', () => {
  it('POSTs to /retry and unwraps the email', async () => {
    api.post.mockResolvedValue({ data: { data: { email: { id: 'e1', status: 'skipped' } } } });
    const email = await retryEmail('e1');
    expect(api.post).toHaveBeenCalledWith('/emails/e1/retry');
    expect(email).toEqual({ id: 'e1', status: 'skipped' });
  });
});
