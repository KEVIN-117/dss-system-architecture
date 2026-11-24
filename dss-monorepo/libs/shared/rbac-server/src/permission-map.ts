import type { RoleMatch } from './permissions.js';

/**
 * Permissions the DSS applications check today. They live in Keycloak as roles of the catalog client
 * `dss-permissions` (IAM-002) and reach the token in `resource_access.dss-permissions.roles`; which roles
 * grant them is data managed from the admin portal, not code (IAM-014). The list only names the known
 * ones for autocompletion: any other permission string is valid, so a permission created from the admin
 * portal works without deploying the frontend.
 */
export const DSS_PERMISSIONS = [
  'analytics:read', 'analytics:global', 'analytics:faculty', 'analytics:career',
  'connectors:read', 'connectors:write', 'pipelines:read', 'pipelines:execute',
  'prediction:train', 'prediction:publish', 'prediction:forecast:read',
  'olap:admin', 'olap:user',
  'dw:closure:read', 'dw:closure:manage', 'dw:etl-monitor:read', 'dw:etl:execute', 'dw:etl-schedule:manage',
  'iam:users:read', 'iam:users:write', 'iam:roles:read', 'iam:roles:write',
  'iam:clients:read', 'iam:clients:write', 'iam:audit:read',
] as const;

export type KnownDSSPermission = (typeof DSS_PERMISSIONS)[number];
/** A known permission, or any other `resource:action` created from the admin portal. */
export type DSSPermission = KnownDSSPermission | (string & {});

/** The permissions a principal holds, as granted by the token. */
export type PermissionSet = ReadonlySet<string> | readonly string[];

function toSet(permissions: PermissionSet): ReadonlySet<string> {
  return permissions instanceof Set ? permissions : new Set(permissions);
}

export function hasPermission(permissions: PermissionSet, permission: DSSPermission): boolean {
  return toSet(permissions).has(permission);
}

export function hasAnyPermissions(permissions: PermissionSet, required: readonly DSSPermission[]): boolean {
  if (required.length === 0) return false;
  const granted = toSet(permissions);
  return required.some((permission) => granted.has(permission));
}

export function hasAllPermissions(permissions: PermissionSet, required: readonly DSSPermission[]): boolean {
  if (required.length === 0) return false;
  const granted = toSet(permissions);
  return required.every((permission) => granted.has(permission));
}

export function hasRequiredPermissions(
  permissions: PermissionSet,
  required: readonly DSSPermission[],
  match: RoleMatch = 'any',
): boolean {
  return match === 'all'
    ? hasAllPermissions(permissions, required)
    : hasAnyPermissions(permissions, required);
}
