import { describe, expect, it } from 'vitest';

import {
  hasAllPermissions,
  hasAnyPermissions,
  hasPermission,
  hasRequiredPermissions,
  resolvePermissions,
} from './permission-map';

describe('DSS permission policy', () => {
  it('derives academic permissions through the documented role hierarchy', () => {
    expect([...resolvePermissions(['RECTOR'])]).toEqual([
      'analytics:read',
      'analytics:career',
      'analytics:faculty',
      'pipelines:read',
      'analytics:global',
      'connectors:read',
    ]);
    expect(hasPermission(['DECANO'], 'analytics:career')).toBe(true);
    expect(hasPermission(['DIRECTOR'], 'analytics:faculty')).toBe(false);
  });

  it('keeps SUPERADMIN technical and outside academic analytics', () => {
    expect(hasPermission(['SUPERADMIN'], 'users:write')).toBe(true);
    expect(hasPermission(['SUPERADMIN'], 'connectors:write')).toBe(true);
    expect(hasPermission(['SUPERADMIN'], 'pipelines:execute')).toBe(true);
    expect(hasPermission(['SUPERADMIN'], 'analytics:global')).toBe(false);
    expect(hasPermission(['SUPERADMIN'], 'analytics:career')).toBe(false);
  });

  it('supports any, all, and empty requirements without granting access', () => {
    expect(hasAnyPermissions(['DECANO'], ['analytics:global', 'analytics:faculty'])).toBe(true);
    expect(hasAllPermissions(['RECTOR'], ['analytics:faculty', 'analytics:global'])).toBe(true);
    expect(hasRequiredPermissions(['DIRECTOR'], ['analytics:read', 'analytics:faculty'], 'all')).toBe(false);
    expect(hasAnyPermissions(['RECTOR'], [])).toBe(false);
    expect(hasAllPermissions(['RECTOR'], [])).toBe(false);
  });
});
