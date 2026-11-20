import {
  isIamActionsEmailRequest,
  isIamCreateClientRequest,
  isIamCreatePermissionRequest,
  isIamCreateRoleRequest,
  isIamCreateUserRequest,
  isIamReplacePermissionsRequest,
  isIamReplaceRolePermissionsRequest,
  isIamReplaceRolesRequest,
  isIamUpdateClientRequest,
  isIamUpdatePermissionRequest,
  isIamUpdateRoleRequest,
  isIamUpdateUserRequest,
  IAM_PERMISSION_NAME_PATTERN,
} from '@dss-monorepo/auth-models';
import type { IamHttpMethod } from '@dss-monorepo/auth-connector';

/**
 * The BFF surface of the auth-service IAM API (IAM-015): `/api/admin/iam/<path>` maps one-to-one to
 * `/api/v1/admin/iam/<path>`. Every operation names the `iam:*` permission the BFF requires before
 * forwarding (auth-service checks it again), how its path parameters, query and body are validated,
 * and whether its response carries a secret.
 */
export type IamParam = 'userId' | 'roleName' | 'permissionName' | 'clientId';
type Segment = string | { param: IamParam };

type QueryRule = (value: string) => boolean;

export interface IamOperation {
  method: IamHttpMethod;
  segments: readonly Segment[];
  permission: string;
  /** Body guard; operations without one must not receive a body. */
  body?: (value: unknown) => boolean;
  /** Allowed query parameters; any other parameter is rejected. */
  query?: Readonly<Record<string, QueryRule>>;
  /** The response contains a client secret shown once. */
  secret?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Role names and client ids also include Keycloak's built-in ones (`offline_access`, `realm-management`). */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/;

export const IAM_PARAMS: Readonly<Record<IamParam, (value: string) => boolean>> = {
  userId: (value) => UUID.test(value),
  roleName: (value) => SAFE_NAME.test(value),
  permissionName: (value) => value.length <= 100 && IAM_PERMISSION_NAME_PATTERN.test(value),
  clientId: (value) => SAFE_NAME.test(value),
};

const text = (max: number): QueryRule => (value) => value.length > 0 && value.length <= max;
const oneOf = (...values: string[]): QueryRule => (value) => values.includes(value);
const integer = (min: number, max = Number.MAX_SAFE_INTEGER): QueryRule => (value) =>
  /^\d{1,9}$/.test(value) && Number(value) >= min && Number(value) <= max;
const dateTime: QueryRule = (value) =>
  value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
const flag = oneOf('true', 'false');

const user = { param: 'userId' } as const;
const role = { param: 'roleName' } as const;
const permission = { param: 'permissionName' } as const;
const client = { param: 'clientId' } as const;

export const IAM_OPERATIONS: readonly IamOperation[] = [
  // Users (IAM-006). The user directory itself stays at /api/admin/users.
  { method: 'POST', segments: ['users'], permission: 'iam:users:write', body: isIamCreateUserRequest },
  { method: 'POST', segments: ['users', 'resync'], permission: 'iam:users:write' },
  { method: 'PATCH', segments: ['users', user], permission: 'iam:users:write', body: isIamUpdateUserRequest },
  { method: 'POST', segments: ['users', user, 'actions-email'], permission: 'iam:users:write', body: isIamActionsEmailRequest },
  { method: 'GET', segments: ['users', user, 'roles'], permission: 'iam:users:read' },
  { method: 'PUT', segments: ['users', user, 'roles'], permission: 'iam:users:write', body: isIamReplaceRolesRequest },
  { method: 'GET', segments: ['users', user, 'permissions'], permission: 'iam:users:read' },
  { method: 'PUT', segments: ['users', user, 'permissions'], permission: 'iam:users:write', body: isIamReplacePermissionsRequest },
  // Roles and permissions (IAM-007).
  { method: 'GET', segments: ['roles'], permission: 'iam:roles:read' },
  { method: 'POST', segments: ['roles'], permission: 'iam:roles:write', body: isIamCreateRoleRequest },
  { method: 'GET', segments: ['roles', role], permission: 'iam:roles:read' },
  { method: 'PATCH', segments: ['roles', role], permission: 'iam:roles:write', body: isIamUpdateRoleRequest },
  { method: 'DELETE', segments: ['roles', role], permission: 'iam:roles:write', query: { force: flag } },
  { method: 'GET', segments: ['roles', role, 'permissions'], permission: 'iam:roles:read' },
  { method: 'PUT', segments: ['roles', role, 'permissions'], permission: 'iam:roles:write', body: isIamReplaceRolePermissionsRequest },
  { method: 'GET', segments: ['permissions'], permission: 'iam:roles:read' },
  { method: 'POST', segments: ['permissions'], permission: 'iam:roles:write', body: isIamCreatePermissionRequest },
  { method: 'GET', segments: ['permissions', 'matrix'], permission: 'iam:roles:read' },
  { method: 'PATCH', segments: ['permissions', permission], permission: 'iam:roles:write', body: isIamUpdatePermissionRequest },
  { method: 'DELETE', segments: ['permissions', permission], permission: 'iam:roles:write', query: { force: flag } },
  // Applications (IAM-008).
  {
    method: 'GET', segments: ['clients'], permission: 'iam:clients:read',
    query: { search: text(64), page: integer(0), size: integer(1, 200) },
  },
  { method: 'POST', segments: ['clients'], permission: 'iam:clients:write', body: isIamCreateClientRequest, secret: true },
  { method: 'GET', segments: ['clients', client], permission: 'iam:clients:read' },
  { method: 'PATCH', segments: ['clients', client], permission: 'iam:clients:write', body: isIamUpdateClientRequest },
  { method: 'POST', segments: ['clients', client, 'secret'], permission: 'iam:clients:write', secret: true },
  // Audit (IAM-005).
  {
    method: 'GET', segments: ['audit'], permission: 'iam:audit:read',
    query: {
      actor: text(255), action: text(100), targetType: oneOf('USER', 'ROLE', 'PERMISSION', 'CLIENT'),
      targetId: text(255), outcome: oneOf('PENDING', 'SUCCESS', 'FAILURE'), from: dateTime, to: dateTime,
      page: integer(0), size: integer(1, 100),
    },
  },
];

export type IamMatch =
  | { kind: 'operation'; operation: IamOperation; upstreamPath: string }
  | { kind: 'not-found' }
  | { kind: 'invalid-param'; param: IamParam };

/**
 * Resolves `segments` (already URL-decoded by Next.js) and the method to one operation. A literal segment
 * wins over a parameter, so `users/resync` and `permissions/matrix` are never read as identifiers.
 */
export function matchIamOperation(method: string, segments: readonly string[]): IamMatch {
  let invalid: IamParam | null = null;
  const candidates = IAM_OPERATIONS.filter((operation) => operation.method === method &&
    operation.segments.length === segments.length);
  const ranked = [...candidates].sort(
    (left, right) => literalCount(right) - literalCount(left),
  );
  for (const operation of ranked) {
    let matches = true;
    const encoded: string[] = [];
    operation.segments.forEach((segment, index) => {
      if (!matches) return;
      const value = segments[index];
      if (typeof segment === 'string') {
        matches = segment === value;
        encoded.push(segment);
      } else if (IAM_PARAMS[segment.param](value)) {
        encoded.push(encodeURIComponent(value));
      } else {
        invalid ??= segment.param;
        matches = false;
      }
    });
    if (matches) return { kind: 'operation', operation, upstreamPath: `/admin/iam/${encoded.join('/')}` };
  }
  return invalid ? { kind: 'invalid-param', param: invalid } : { kind: 'not-found' };
}

/** Only the declared parameters, each valid and given once. */
export function validateIamQuery(operation: IamOperation, query: URLSearchParams): URLSearchParams | null {
  const rules = operation.query ?? {};
  const keys = [...query.keys()];
  if (new Set(keys).size !== keys.length) return null;
  for (const [key, value] of query) {
    const rule = rules[key];
    if (!rule || !rule(value)) return null;
  }
  return new URLSearchParams(query);
}

function literalCount(operation: IamOperation): number {
  return operation.segments.filter((segment) => typeof segment === 'string').length;
}
