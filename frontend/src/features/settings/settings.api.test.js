import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  getMySettings,
  updateMySettings,
  changeMyPassword,
  getOrgSettings,
  updateOrgSettings,
} from '@/features/settings/settings.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMySettings', () => {
  it('unwraps the user', async () => {
    api.get.mockResolvedValue({ data: { data: { user: { id: 'u1', firstName: 'Ada' } } } });
    const user = await getMySettings();
    expect(api.get).toHaveBeenCalledWith('/settings/me');
    expect(user).toEqual({ id: 'u1', firstName: 'Ada' });
  });
});

describe('updateMySettings', () => {
  it('PATCHes and returns the updated user', async () => {
    api.patch.mockResolvedValue({ data: { data: { user: { id: 'u1', firstName: 'New' } } } });
    const payload = { firstName: 'New', preferences: { theme: 'dark' } };
    const user = await updateMySettings(payload);
    expect(api.patch).toHaveBeenCalledWith('/settings/me', payload);
    expect(user).toEqual({ id: 'u1', firstName: 'New' });
  });
});

describe('changeMyPassword', () => {
  it('POSTs the password change', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const payload = { currentPassword: 'old', newPassword: 'BrandN3wPass' };
    await changeMyPassword(payload);
    expect(api.post).toHaveBeenCalledWith('/settings/me/password', payload);
  });
});

describe('getOrgSettings', () => {
  it('unwraps the settings', async () => {
    api.get.mockResolvedValue({ data: { data: { settings: { defaultCurrency: 'USD' } } } });
    const settings = await getOrgSettings();
    expect(api.get).toHaveBeenCalledWith('/settings/organization');
    expect(settings).toEqual({ defaultCurrency: 'USD' });
  });
});

describe('updateOrgSettings', () => {
  it('PATCHes and returns the updated settings', async () => {
    api.patch.mockResolvedValue({ data: { data: { settings: { defaultCurrency: 'EUR' } } } });
    const settings = await updateOrgSettings({ defaultCurrency: 'EUR' });
    expect(api.patch).toHaveBeenCalledWith('/settings/organization', { defaultCurrency: 'EUR' });
    expect(settings).toEqual({ defaultCurrency: 'EUR' });
  });
});
