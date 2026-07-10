import { describe, it, expect } from 'vitest';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

describe('PERMISSIONS catalog', () => {
  it('mirrors the backend capability strings', () => {
    expect(PERMISSIONS).toMatchObject({
      USER_READ: 'user:read',
      USER_UPDATE_ROLE: 'user:update_role',
      USER_UPDATE_STATUS: 'user:update_status',
      USER_DELETE: 'user:delete',
    });
  });
});

describe('hasPermission', () => {
  it('is true when the permission is granted', () => {
    expect(hasPermission(['user:read', 'user:update_role'], 'user:read')).toBe(true);
  });

  it('is false when the permission is absent', () => {
    expect(hasPermission(['user:read'], 'user:delete')).toBe(false);
  });

  it('is false for a null/undefined or non-array grant list', () => {
    expect(hasPermission(null, 'user:read')).toBe(false);
    expect(hasPermission(undefined, 'user:read')).toBe(false);
    expect(hasPermission('user:read', 'user:read')).toBe(false);
  });
});
