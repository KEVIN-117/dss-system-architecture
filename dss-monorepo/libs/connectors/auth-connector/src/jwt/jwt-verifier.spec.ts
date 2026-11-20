import { describe, expect, it } from 'vitest';

import { extractDssRoles, extractPermissions } from './jwt-verifier.js';

describe('extractDssRoles', () => {
  it('uses the configured client and removes roles outside the DSS vocabulary', () => {
    const roles = extractDssRoles({
      realm_access: { roles: ['RECTOR', 'offline_access'] },
      resource_access: {
        'uatf-auth-service': { roles: ['DECANO'] },
        'other-client': { roles: ['SUPERADMIN'] },
      },
    }, 'uatf-auth-service');

    expect(roles).toEqual(['RECTOR', 'DECANO']);
  });

  it('maps configured realm roles to a portal instead of discarding them (IAM-014)', () => {
    const claims = {
      realm_access: { roles: ['VICERRECTOR', 'COORDINADOR', 'offline_access'] },
      resource_access: { 'uatf-auth-service': { roles: ['VICERRECTOR'] } },
    };

    expect(extractDssRoles(claims, 'uatf-auth-service')).toEqual([]);
    expect(extractDssRoles(claims, 'uatf-auth-service', { VICERRECTOR: 'RECTOR' })).toEqual(['RECTOR']);
    // Only realm roles are mapped; a client role with the same name opens nothing.
    expect(extractDssRoles({ resource_access: claims.resource_access }, 'uatf-auth-service', { VICERRECTOR: 'RECTOR' }))
      .toEqual([]);
    // Inherited object keys are not role mappings.
    expect(extractDssRoles({ realm_access: { roles: ['toString'] } }, 'uatf-auth-service', {})).toEqual([]);
  });
});

describe('extractPermissions', () => {
  it('reads only the catalog client and keeps unknown permissions (IAM-014)', () => {
    const claims = {
      realm_access: { roles: ['analytics:global'] },
      resource_access: {
        'dss-permissions': { roles: ['analytics:read', 'reports:export', 'analytics:read'] },
        'olap-service': { roles: ['olap:admin'] },
      },
    };

    expect(extractPermissions(claims)).toEqual(['analytics:read', 'reports:export']);
    expect(extractPermissions(claims, 'olap-service')).toEqual(['olap:admin']);
    expect(extractPermissions({})).toEqual([]);
  });
});
