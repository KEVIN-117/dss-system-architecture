import { describe, expect, it } from 'vitest';

import type { DSSRole } from '@dss-monorepo/auth-models';

import { canAccess } from './can-access';

const as = (roles: DSSRole[], permissions: string[] = []) => ({ roles, permissions });

describe('Can access evaluation', () => {
  it('uses role hierarchy for positive portal checks', () => {
    expect(canAccess(as(['RECTOR']), { role: 'DIRECTOR' })).toBe(true);
    expect(canAccess(as(['DIRECTOR']), { role: 'DECANO' })).toBe(false);
  });

  it('uses exact role membership for negative checks', () => {
    expect(canAccess(as(['DIRECTOR']), { role: 'DIRECTOR', not: true })).toBe(false);
    expect(canAccess(as(['DECANO']), { role: 'DIRECTOR', not: true })).toBe(true);
    expect(canAccess(as(['RECTOR']), { role: 'DIRECTOR', not: true })).toBe(true);
    expect(canAccess(as(['SUPERADMIN']), { role: 'DIRECTOR', not: true })).toBe(true);
  });

  it('checks permissions from the token, never from roles', () => {
    expect(canAccess(as([], ['analytics:global']), { permission: 'analytics:global' })).toBe(true);
    expect(canAccess(as(['RECTOR']), { permission: 'analytics:global' })).toBe(false);
    expect(canAccess(as(['SUPERADMIN'], ['iam:users:read']), { permission: 'analytics:global' })).toBe(false);
    expect(canAccess(as([], ['reports:export']), { permission: 'reports:export' })).toBe(true);
    expect(canAccess(as([], ['olap:admin']), { permissions: ['analytics:read', 'olap:admin'] })).toBe(true);
    expect(
      canAccess(as([], ['analytics:read']), { permissions: ['analytics:read', 'olap:admin'], match: 'all' }),
    ).toBe(false);
    expect(canAccess(as([], ['analytics:read']), { permission: 'analytics:read', not: true })).toBe(false);
  });

  it('fails closed for empty lists', () => {
    expect(canAccess(as(['DIRECTOR'], ['analytics:read']), { permissions: [] })).toBe(false);
    expect(canAccess(as(['DIRECTOR']), { roles: [], not: true })).toBe(false);
  });
});
