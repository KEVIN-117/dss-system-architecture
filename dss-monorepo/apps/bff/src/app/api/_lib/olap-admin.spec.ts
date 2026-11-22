import { describe, expect, it } from 'vitest';

import { hasOlapAdminAccess, olapAdminForbidden } from './olap-admin';

describe('OLAP admin access (IAM-012, IAM-019)', () => {
  it('grants access with the olap:admin permission', () => {
    expect(hasOlapAdminAccess(['analytics:read', 'olap:admin'])).toBe(true);
  });

  it('does not let platform roles, misplaced names or the retired OLAP_ADMIN role grant administration', () => {
    expect(hasOlapAdminAccess(['iam:users:write', 'OLAP_ADMIN', 'OLAP_USER', 'olap:user'])).toBe(false);
    expect(hasOlapAdminAccess([])).toBe(false);
  });

  it('names the required permission when it refuses', async () => {
    const response = olapAdminForbidden();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Insufficient permissions',
      requiredPermissions: ['olap:admin'],
    });
  });
});
