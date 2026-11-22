import { describe, expect, it } from 'vitest';

import { extractDssRoles, extractPermissions } from './jwt-verifier.js';

describe('extractDssRoles', () => {
  it('reads realm roles only and removes roles outside the DSS vocabulary (IAM-019)', () => {
    const roles = extractDssRoles({
      realm_access: { roles: ['RECTOR', 'offline_access'] },
      resource_access: {
        'uatf-auth-service': { roles: ['DECANO'] },
        'other-client': { roles: ['SUPERADMIN'] },
      },
    } as Parameters<typeof extractDssRoles>[0]);

    // The retired uatf-auth-service client roles no longer open a portal.
    expect(roles).toEqual(['RECTOR']);
  });

  it('maps configured realm roles to a portal instead of discarding them (IAM-014)', () => {
    const claims = {
      realm_access: { roles: ['VICERRECTOR', 'COORDINADOR', 'offline_access'] },
    };

    expect(extractDssRoles(claims)).toEqual([]);
    expect(extractDssRoles(claims, { VICERRECTOR: 'RECTOR' })).toEqual(['RECTOR']);
    // Only realm roles are mapped; without them nothing opens.
    expect(extractDssRoles({}, { VICERRECTOR: 'RECTOR' })).toEqual([]);
    // Inherited object keys are not role mappings.
    expect(extractDssRoles({ realm_access: { roles: ['toString'] } }, {})).toEqual([]);
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
