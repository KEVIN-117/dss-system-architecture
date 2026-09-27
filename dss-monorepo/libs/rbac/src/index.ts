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
export { Can } from './lib/Can';
export type { CanProps } from './lib/Can';
export { RoleGate } from './lib/RoleGate';
export type { RoleGateProps } from './lib/RoleGate';
export { RoleGuard } from './lib/RoleGuard';
export type { RoleGuardProps } from './lib/RoleGuard';

export {
  useCan,
  useHasPermission,
  useHasRole,
  useMyPermissions,
} from './lib/useCan';
export type { CanCheck } from './lib/can-access';
export { usePermission } from './lib/usePermission';
