import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn() },
}));

import { api } from '@/lib/api';
import { listUsers, getUser, updateUserRole, updateUserStatus } from '@/features/users/users.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listUsers', () => {
  it('unwraps users + meta and strips empty filter params', async () => {
    api.get.mockResolvedValue({
      data: {
        data: { users: [{ id: '1' }] },
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      },
    });

    const result = await listUsers({ page: 1, limit: 20, q: '', role: undefined, status: 'active' });

    expect(api.get).toHaveBeenCalledWith('/users', {
      params: { page: 1, limit: 20, status: 'active' },
    });
    expect(result).toEqual({
      users: [{ id: '1' }],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });
});

describe('getUser', () => {
  it('requests by id and returns the user', async () => {
    api.get.mockResolvedValue({ data: { data: { user: { id: 'abc' } } } });
    const user = await getUser('abc');
    expect(api.get).toHaveBeenCalledWith('/users/abc');
    expect(user).toEqual({ id: 'abc' });
  });
});

describe('updateUserRole', () => {
  it('PATCHes the role and returns the updated user', async () => {
    api.patch.mockResolvedValue({ data: { data: { user: { id: 'abc', role: 'manager' } } } });
    const user = await updateUserRole('abc', 'manager');
    expect(api.patch).toHaveBeenCalledWith('/users/abc/role', { role: 'manager' });
    expect(user).toEqual({ id: 'abc', role: 'manager' });
  });
});

describe('updateUserStatus', () => {
  it('PATCHes the status and returns the updated user', async () => {
    api.patch.mockResolvedValue({ data: { data: { user: { id: 'abc', status: 'suspended' } } } });
    const user = await updateUserStatus('abc', 'suspended');
    expect(api.patch).toHaveBeenCalledWith('/users/abc/status', { status: 'suspended' });
    expect(user).toEqual({ id: 'abc', status: 'suspended' });
  });
});
