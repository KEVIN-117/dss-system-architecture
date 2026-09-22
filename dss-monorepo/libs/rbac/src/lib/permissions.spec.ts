import { describe, expect, it } from 'vitest';

import {
  getHighestRole,
  hasAllRoles,
  hasAnyRole,
  hasRequiredRoles,
  hasRole,
} from './permissions';

describe('DSS role policy', () => {
  it('keeps the technical SUPERADMIN role out of academic dashboards', () => {
    expect(hasRole(['SUPERADMIN'], 'SUPERADMIN')).toBe(true);
    expect(hasRole(['SUPERADMIN'], 'RECTOR')).toBe(false);
    expect(hasRole(['SUPERADMIN'], 'DECANO')).toBe(false);
    expect(hasRole(['SUPERADMIN'], 'DIRECTOR')).toBe(false);
  });

  it('applies only the documented academic hierarchy', () => {
    expect(hasRole(['RECTOR'], 'DIRECTOR')).toBe(true);
    expect(hasRole(['DECANO'], 'DIRECTOR')).toBe(true);
    expect(hasRole(['DIRECTOR'], 'DECANO')).toBe(false);
  });

  it('supports explicit any and all matching while empty requirements fail closed', () => {
    expect(hasAnyRole(['DECANO'], ['RECTOR', 'DECANO'])).toBe(true);
    expect(hasAllRoles(['RECTOR'], ['DECANO', 'DIRECTOR'])).toBe(true);
    expect(hasRequiredRoles(['DIRECTOR'], ['DECANO', 'DIRECTOR'], 'all')).toBe(false);
    expect(hasAnyRole(['RECTOR'], [])).toBe(false);
    expect(hasAllRoles(['RECTOR'], [])).toBe(false);
  });

  it('returns the highest role for presentation without using it for access', () => {
    expect(getHighestRole(['DIRECTOR', 'DECANO'])).toBe('DECANO');
    expect(getHighestRole([])).toBeNull();
  });
});
