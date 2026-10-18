import type { DSSRole } from '@dss-monorepo/auth-models';

import { hasRequiredPermissions, type DSSPermission } from './permission-map.js';
import { hasRequiredRoles, type RoleMatch } from './permissions.js';

export interface RbacPrincipal {
  roles: readonly DSSRole[];
}

interface RolePolicy {
  roles: readonly DSSRole[];
  permissions?: never;
  match?: RoleMatch;
}

interface PermissionPolicy {
  permissions: readonly DSSPermission[];
  roles?: never;
  match?: RoleMatch;
}

export type RbacPolicy = RolePolicy | PermissionPolicy;
export type RbacPrincipalResolver = (request: Request) => RbacPrincipal | null | Promise<RbacPrincipal | null>;
export type RbacMiddlewareHandler = (request: Request) => Response | Promise<Response>;
export type RbacMiddlewareOptions = RbacPolicy & { resolvePrincipal: RbacPrincipalResolver };

export function isRbacAllowed(roles: readonly DSSRole[], policy: RbacPolicy): boolean {
  if ('roles' in policy && policy.roles !== undefined) {
    return hasRequiredRoles(roles, policy.roles, policy.match);
  }
  return hasRequiredPermissions(roles, policy.permissions, policy.match);
}

export function withRbacMiddleware(
  options: RbacMiddlewareOptions,
  handler: RbacMiddlewareHandler,
): RbacMiddlewareHandler {
  return async (request) => {
    const principal = await options.resolvePrincipal(request);
    if (!principal) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (!isRbacAllowed(principal.roles, options)) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return handler(request);
  };
}
