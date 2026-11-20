import { NextResponse } from 'next/server';

type Environment = Readonly<Record<string, string | undefined>>;

/** Permission of the `dss-permissions` catalog client that grants Saiku administration (IAM-012). */
export const OLAP_ADMIN_PERMISSION = 'olap:admin';
const LEGACY_OLAP_ADMIN_ROLE = 'OLAP_ADMIN';

export interface OlapAdminAccessConfig {
  permissionsClientId: string;
  legacyClientId: string;
  legacyRolesEnabled: boolean;
}

/**
 * Same switches as olap-service: `KEYCLOAK_PERMISSIONS_CLIENT_ID` (default `dss-permissions`),
 * `KEYCLOAK_OLAP_CLIENT_ID` (default `olap-service`) and `OLAP_LEGACY_ROLES_ENABLED` (anything but
 * `false` keeps the coexistence on).
 */
export function getOlapAdminAccessConfig(
  environment: Environment = process.env,
): OlapAdminAccessConfig {
  return {
    permissionsClientId:
      environment.KEYCLOAK_PERMISSIONS_CLIENT_ID?.trim() || 'dss-permissions',
    legacyClientId: environment.KEYCLOAK_OLAP_CLIENT_ID?.trim() || 'olap-service',
    legacyRolesEnabled:
      environment.OLAP_LEGACY_ROLES_ENABLED?.trim().toLowerCase() !== 'false',
  };
}

/**
 * Saiku administration (`/rest/saiku/admin/**`) is its own permission, separate from business access
 * (D4): `olap:admin` of the catalog client, or the legacy `OLAP_ADMIN` of the OLAP client during the
 * coexistence. Platform roles such as SUPERADMIN do not imply it.
 */
export function hasOlapAdminAccess(
  clientRoles: Readonly<Record<string, readonly string[]>>,
  config: OlapAdminAccessConfig = getOlapAdminAccessConfig(),
): boolean {
  if ((clientRoles[config.permissionsClientId] ?? []).includes(OLAP_ADMIN_PERMISSION)) {
    return true;
  }
  return (
    config.legacyRolesEnabled &&
    (clientRoles[config.legacyClientId] ?? []).includes(LEGACY_OLAP_ADMIN_ROLE)
  );
}

export function olapAdminForbidden(): NextResponse {
  return NextResponse.json(
    {
      error: 'Insufficient permissions',
      requiredPermissions: [OLAP_ADMIN_PERMISSION],
    },
    { status: 403 },
  );
}
