import { NextResponse } from 'next/server';

/** Permission of the `dss-permissions` catalog client that grants Saiku administration (IAM-012). */
export const OLAP_ADMIN_PERMISSION = 'olap:admin';

/**
 * Saiku administration (`/rest/saiku/admin/**`) is its own permission, separate from business access
 * (D4): `olap:admin` of the catalog client, the same rule olap-service enforces. Platform roles such as
 * SUPERADMIN do not imply it, and the legacy `OLAP_ADMIN` client role was retired in IAM-019.
 */
export function hasOlapAdminAccess(permissions: readonly string[]): boolean {
  return permissions.includes(OLAP_ADMIN_PERMISSION);
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
