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
export { RoleGate } from './lib/RoleGate';
export type { RoleGateProps } from './lib/RoleGate';
export { usePermission } from './lib/usePermission';
