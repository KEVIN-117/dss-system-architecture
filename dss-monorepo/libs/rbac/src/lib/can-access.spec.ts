import { describe, expect, it } from 'vitest';

import { canAccess } from './can-access';

describe('Can access evaluation', () => {
  it('uses role hierarchy for positive checks', () => {
    expect(canAccess(['RECTOR'], { role: 'DIRECTOR' })).toBe(true);
    expect(canAccess(['DIRECTOR'], { role: 'DECANO' })).toBe(false);
  });

  it('uses exact role membership for negative checks', () => {
    expect(canAccess(['DIRECTOR'], { role: 'DIRECTOR', not: true })).toBe(false);
    expect(canAccess(['DECANO'], { role: 'DIRECTOR', not: true })).toBe(true);
    expect(canAccess(['RECTOR'], { role: 'DIRECTOR', not: true })).toBe(true);
    expect(canAccess(['SUPERADMIN'], { role: 'DIRECTOR', not: true })).toBe(true);
  });

  it('supports permission checks and fails closed for empty lists', () => {
    expect(canAccess(['RECTOR'], { permission: 'analytics:global' })).toBe(true);
    expect(canAccess(['SUPERADMIN'], { permission: 'analytics:global' })).toBe(false);
    expect(canAccess(['DIRECTOR'], { permissions: [] })).toBe(false);
    expect(canAccess(['DIRECTOR'], { roles: [], not: true })).toBe(false);
  });
});
