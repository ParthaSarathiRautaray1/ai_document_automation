import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  getMyOrganization,
  updateMyOrganization,
  listMembers,
  inviteMember,
  removeMember,
} from '@/features/organizations/organizations.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMyOrganization', () => {
  it('unwraps the organization', async () => {
    api.get.mockResolvedValue({ data: { data: { organization: { id: 'o1', name: 'Acme' } } } });
    const org = await getMyOrganization();
    expect(api.get).toHaveBeenCalledWith('/organizations/me');
    expect(org).toEqual({ id: 'o1', name: 'Acme' });
  });
});

describe('updateMyOrganization', () => {
  it('PATCHes and returns the updated organization', async () => {
    api.patch.mockResolvedValue({ data: { data: { organization: { id: 'o1', name: 'New' } } } });
    const org = await updateMyOrganization({ name: 'New' });
    expect(api.patch).toHaveBeenCalledWith('/organizations/me', { name: 'New' });
    expect(org).toEqual({ id: 'o1', name: 'New' });
  });
});

describe('listMembers', () => {
  it('unwraps members + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { members: [{ id: '1' }] }, meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    });
    const result = await listMembers({ page: 1, q: '', role: undefined });
    expect(api.get).toHaveBeenCalledWith('/organizations/members', { params: { page: 1 } });
    expect(result).toEqual({ members: [{ id: '1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  });
});

describe('inviteMember', () => {
  it('POSTs the invite and returns the member', async () => {
    api.post.mockResolvedValue({ data: { data: { member: { id: 'm1', status: 'invited' } } } });
    const payload = { firstName: 'A', lastName: 'B', email: 'a@b.com' };
    const member = await inviteMember(payload);
    expect(api.post).toHaveBeenCalledWith('/organizations/members/invite', payload);
    expect(member).toEqual({ id: 'm1', status: 'invited' });
  });
});

describe('removeMember', () => {
  it('DELETEs by id', async () => {
    api.delete.mockResolvedValue({ data: { success: true } });
    await removeMember('m1');
    expect(api.delete).toHaveBeenCalledWith('/organizations/members/m1');
  });
});
