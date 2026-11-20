import { describe, expect, it } from 'vitest';

import { getOlapAdminAccessConfig, hasOlapAdminAccess } from './olap-admin';

describe('OLAP admin access (IAM-012)', () => {
  const coexistence = getOlapAdminAccessConfig({});
  const permissionsOnly = getOlapAdminAccessConfig({
    OLAP_LEGACY_ROLES_ENABLED: 'false',
  });

  it('defaults to the catalog client with the coexistence on', () => {
    expect(coexistence).toEqual({
      permissionsClientId: 'dss-permissions',
      legacyClientId: 'olap-service',
      legacyRolesEnabled: true,
    });
    expect(getOlapAdminAccessConfig({ OLAP_LEGACY_ROLES_ENABLED: ' FALSE ' }))
      .toMatchObject({ legacyRolesEnabled: false });
    expect(
      getOlapAdminAccessConfig({
        KEYCLOAK_PERMISSIONS_CLIENT_ID: ' catalog ',
        KEYCLOAK_OLAP_CLIENT_ID: 'saiku',
      }),
    ).toMatchObject({ permissionsClientId: 'catalog', legacyClientId: 'saiku' });
  });

  it('grants access with olap:admin of the catalog client', () => {
    const roles = { 'dss-permissions': ['olap:admin'] };
    expect(hasOlapAdminAccess(roles, coexistence)).toBe(true);
    expect(hasOlapAdminAccess(roles, permissionsOnly)).toBe(true);
  });

  it('accepts the legacy OLAP_ADMIN role only during the coexistence', () => {
    const roles = { 'olap-service': ['OLAP_ADMIN'] };
    expect(hasOlapAdminAccess(roles, coexistence)).toBe(true);
    expect(hasOlapAdminAccess(roles, permissionsOnly)).toBe(false);
  });

  it('does not let platform roles or misplaced names grant Saiku administration', () => {
    expect(
      hasOlapAdminAccess(
        {
          'dss-permissions': ['iam:users:write', 'OLAP_ADMIN'],
          'olap-service': ['olap:admin', 'OLAP_USER'],
          'uatf-auth-service': ['SUPERADMIN', 'OLAP_ADMIN'],
        },
        coexistence,
      ),
    ).toBe(false);
    expect(hasOlapAdminAccess({}, coexistence)).toBe(false);
  });
});
