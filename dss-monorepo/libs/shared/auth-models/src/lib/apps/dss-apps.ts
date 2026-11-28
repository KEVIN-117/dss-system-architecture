import type { IamRolePortal } from '../iam/iam-requests.js';

/**
 * Applications of the DSS (IAM-022). A role opens exactly one of them: the one whose access permission
 * (`portal:<id>` in `dss-permissions`) it groups. Shared by admin-portal, landing and the guards.
 */
export interface DssApp {
  id: IamRolePortal;
  /** Access permission the role groups, e.g. `portal:rector`. */
  permission: `portal:${IamRolePortal}`;
  label: string;
  /** Public environment variable with the application's URL. */
  urlEnv: string;
}

export const PORTAL_PERMISSION_PREFIX = 'portal:';

export const DSS_APPS = [
  { id: 'admin', permission: 'portal:admin', label: 'Portal de administración', urlEnv: 'NEXT_PUBLIC_ADMIN_PORTAL_URL' },
  { id: 'rector', permission: 'portal:rector', label: 'Dashboard rector', urlEnv: 'NEXT_PUBLIC_RECTOR_DASHBOARD_URL' },
  { id: 'decano', permission: 'portal:decano', label: 'Dashboard decano', urlEnv: 'NEXT_PUBLIC_DECANO_DASHBOARD_URL' },
  { id: 'director', permission: 'portal:director', label: 'Dashboard director', urlEnv: 'NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL' },
] as const satisfies readonly DssApp[];

export function dssAppById(id: string | null | undefined): DssApp | undefined {
  return DSS_APPS.find((app) => app.id === id);
}

/** Whether a permission is an application access permission (`portal:*`), known or not. */
export function isPortalPermission(permission: string): boolean {
  return permission.startsWith(PORTAL_PERMISSION_PREFIX);
}
