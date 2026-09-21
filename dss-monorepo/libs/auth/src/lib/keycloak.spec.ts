import type Keycloak from 'keycloak-js';
import { describe, expect, it } from 'vitest';

import { extractRoles, filterDSSRoles } from './keycloak';

describe('Keycloak roles', () => {
  it('reads client roles from the configured client instead of a hard-coded resource', () => {
    const keycloak = {
      realmAccess: { roles: ['RECTOR', 'offline_access'] },
      resourceAccess: {
        'dss-portal': { roles: ['DIRECTOR', 'account:manage-account'] },
        'other-client': { roles: ['SUPERADMIN'] },
      },
    } as unknown as Keycloak;

    expect(extractRoles(keycloak, 'dss-portal')).toEqual([
      'RECTOR',
      'offline_access',
      'DIRECTOR',
      'account:manage-account',
    ]);
  });

  it('keeps only DSS roles for presentation decisions', () => {
    expect(filterDSSRoles(['DIRECTOR', 'account:manage-account', 'RECTOR'])).toEqual([
      'DIRECTOR',
      'RECTOR',
    ]);
  });
});
