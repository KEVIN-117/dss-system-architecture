import { describe, expect, it } from 'vitest';

import { extractDssRoles } from './jwt-verifier.js';

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
});
