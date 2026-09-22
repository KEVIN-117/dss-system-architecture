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
export type { DSSRole } from '@dss-monorepo/auth/server';
