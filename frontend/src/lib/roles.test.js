import { describe, it, expect } from 'vitest';
import { ROLES, assignableRoles, canManageTarget, roleLabel } from '@/lib/roles';

const admin = { id: 'a', role: ROLES.ADMIN };
const manager = { id: 'm', role: ROLES.MANAGER };
const member = { id: 'u', role: ROLES.MEMBER };
const superAdmin = { id: 's', role: ROLES.SUPER_ADMIN };

describe('roleLabel', () => {
  it('humanizes role slugs', () => {
    expect(roleLabel('super_admin')).toBe('Super admin');
    expect(roleLabel('member')).toBe('Member');
    expect(roleLabel('')).toBe('');
  });
});

describe('canManageTarget', () => {
  it('allows acting on a strictly-lower-ranked user', () => {
    expect(canManageTarget(admin, manager)).toBe(true);
    expect(canManageTarget(admin, member)).toBe(true);
  });

  it('forbids acting on yourself', () => {
    expect(canManageTarget(admin, { id: 'a', role: ROLES.MEMBER })).toBe(false);
  });

  it('forbids acting on a peer or a superior', () => {
    expect(canManageTarget(admin, { id: 'x', role: ROLES.ADMIN })).toBe(false);
    expect(canManageTarget(manager, admin)).toBe(false);
  });
});

describe('assignableRoles', () => {
  it('offers only roles strictly below the actor', () => {
    expect(assignableRoles(admin)).toEqual([ROLES.MEMBER, ROLES.MANAGER]);
    expect(assignableRoles(superAdmin)).toEqual([ROLES.MEMBER, ROLES.MANAGER, ROLES.ADMIN]);
  });

  it('never includes super_admin (cannot be assigned via the UI)', () => {
    expect(assignableRoles(superAdmin)).not.toContain(ROLES.SUPER_ADMIN);
  });

  it('is empty for a member (no one to manage)', () => {
    expect(assignableRoles(member)).toEqual([]);
  });
});
