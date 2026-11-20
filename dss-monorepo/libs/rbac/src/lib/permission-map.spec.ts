import { describe, expect, it } from 'vitest';

import {
  DSS_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermissions,
  hasPermission,
  hasRequiredPermissions,
} from './permission-map';

/** IAM-014: permissions are whatever the token grants, never derived from roles. */
describe('DSS permission policy', () => {
  const director = ['analytics:read', 'analytics:career'];
  const superadmin = ['iam:users:read', 'iam:users:write', 'prediction:train'];

  it('reads permissions exactly as the token grants them', () => {
    expect(hasPermission(director, 'analytics:career')).toBe(true);
    expect(hasPermission(director, 'analytics:faculty')).toBe(false);
    expect(hasPermission(new Set(director), 'analytics:read')).toBe(true);
  });

  it('accepts permissions created from the admin portal without a code change', () => {
    expect(hasPermission(['reports:export'], 'reports:export')).toBe(true);
    expect(DSS_PERMISSIONS).not.toContain('reports:export');
  });

  it('gives nothing implicitly: a platform administrator without analytics has none', () => {
    expect(hasPermission(superadmin, 'iam:users:write')).toBe(true);
    expect(hasPermission(superadmin, 'analytics:global')).toBe(false);
    expect(hasPermission([], 'analytics:read')).toBe(false);
  });

  it('supports any, all, and empty requirements without granting access', () => {
    expect(hasAnyPermissions(director, ['analytics:global', 'analytics:career'])).toBe(true);
    expect(hasAllPermissions(director, ['analytics:read', 'analytics:career'])).toBe(true);
    expect(hasRequiredPermissions(director, ['analytics:read', 'analytics:faculty'], 'all')).toBe(false);
    expect(hasRequiredPermissions(director, ['analytics:read', 'analytics:faculty'])).toBe(true);
    expect(hasAnyPermissions(director, [])).toBe(false);
    expect(hasAllPermissions(director, [])).toBe(false);
  });

  it('names the permissions of the realm catalog', () => {
    for (const permission of ['iam:users:read', 'olap:admin', 'dw:closure:manage', 'prediction:publish']) {
      expect(DSS_PERMISSIONS).toContain(permission);
    }
    expect(DSS_PERMISSIONS).not.toContain('users:write');
  });
});
