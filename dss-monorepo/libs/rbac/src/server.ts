/** Server-safe entry point: role evaluation has no React or browser dependency. */
export {
  ROLE_HIERARCHY,
  ROLE_WEIGHT,
  getHighestRole,
  hasAllRoles,
  hasAnyRole,
  hasRequiredRoles,
  hasRole,
} from './lib/permissions';
export type { RoleMatch } from './lib/permissions';
export {
  DSS_PERMISSIONS,
  ROLE_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermissions,
  hasPermission,
  hasRequiredPermissions,
  resolvePermissions,
} from './lib/permission-map';
export type { DSSPermission } from './lib/permission-map';
export type { DSSRole } from '@dss-monorepo/auth-models';
