/**
 * Request bodies of the auth-service IAM administration API (`/api/v1/admin/iam/**`, IAM-006/007/008),
 * mirrored from `docs/auth/contracts/auth-service-v1.yaml`. The BFF validates every body with these
 * guards before forwarding it (IAM-015); auth-service validates again. Unknown fields are rejected so the
 * BFF never forwards anything the contract does not define.
 */

export type IamRequiredAction = 'UPDATE_PASSWORD' | 'VERIFY_EMAIL' | 'UPDATE_PROFILE' | 'CONFIGURE_TOTP';
export type IamClientType = 'PUBLIC' | 'CONFIDENTIAL';

export interface IamCreateUserRequest {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  sendInvitation?: boolean;
}

export interface IamUpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

export interface IamActionsEmailRequest {
  actions: IamRequiredAction[];
  lifespanHours?: number;
}

export interface IamReplaceRolesRequest {
  roles: string[];
}

export interface IamReplacePermissionsRequest {
  permissions: string[];
}

export interface IamCreateRoleRequest {
  name: string;
  description?: string;
  portal?: string;
}

export interface IamUpdateRoleRequest {
  description?: string;
  /** An empty string removes the portal attribute. */
  portal?: string;
}

export interface IamCreatePermissionRequest {
  name: string;
  description: string;
}

export interface IamUpdatePermissionRequest {
  description: string;
}

export interface IamCreateClientRequest {
  clientId: string;
  name?: string;
  description?: string;
  type: IamClientType;
  enabled?: boolean;
  serviceAccountsEnabled?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
  postLogoutRedirectUris?: string[];
}

export interface IamUpdateClientRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
  postLogoutRedirectUris?: string[];
}

/** Path identifiers, as auth-service accepts them. */
export const IAM_USERNAME_PATTERN = /^[A-Za-z0-9._@-]{3,255}$/;
export const IAM_ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;
export const IAM_PORTAL_PATTERN = /^[a-z][a-z0-9-]{0,49}$/;
export const IAM_PERMISSION_NAME_PATTERN = /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$/;
export const IAM_CLIENT_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
export const IAM_REQUIRED_ACTIONS: readonly IamRequiredAction[] = [
  'UPDATE_PASSWORD', 'VERIFY_EMAIL', 'UPDATE_PROFILE', 'CONFIGURE_TOTP',
];

export function isIamPermissionName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && IAM_PERMISSION_NAME_PATTERN.test(value);
}

export function isIamCreateUserRequest(value: unknown): value is IamCreateUserRequest {
  return shape(value, ['username', 'email'], ['firstName', 'lastName', 'enabled', 'sendInvitation']) &&
    matches(value.username, IAM_USERNAME_PATTERN) &&
    isEmail(value.email) &&
    optional(value.firstName, isText(255)) &&
    optional(value.lastName, isText(255)) &&
    optional(value.enabled, isBoolean) &&
    optional(value.sendInvitation, isBoolean);
}

export function isIamUpdateUserRequest(value: unknown): value is IamUpdateUserRequest {
  return shape(value, [], ['email', 'firstName', 'lastName', 'enabled']) &&
    optional(value.email, isEmail) &&
    optional(value.firstName, isText(255)) &&
    optional(value.lastName, isText(255)) &&
    optional(value.enabled, isBoolean);
}

export function isIamActionsEmailRequest(value: unknown): value is IamActionsEmailRequest {
  return shape(value, ['actions'], ['lifespanHours']) &&
    isUniqueList(value.actions, 1, IAM_REQUIRED_ACTIONS.length,
      (action) => (IAM_REQUIRED_ACTIONS as readonly unknown[]).includes(action)) &&
    optional(value.lifespanHours, (hours) => isInteger(hours) && hours >= 1 && hours <= 720);
}

export function isIamReplaceRolesRequest(value: unknown): value is IamReplaceRolesRequest {
  return shape(value, ['roles'], []) && isUniqueList(value.roles, 0, 500, isText(255, 1));
}

export function isIamReplacePermissionsRequest(value: unknown): value is IamReplacePermissionsRequest {
  return shape(value, ['permissions'], []) && isUniqueList(value.permissions, 0, 500, isText(255, 1));
}

/** Permissions grouped by a role must be catalog names (`resource:action`). */
export function isIamReplaceRolePermissionsRequest(value: unknown): value is IamReplacePermissionsRequest {
  return shape(value, ['permissions'], []) && isUniqueList(value.permissions, 0, 500, isIamPermissionName);
}

export function isIamCreateRoleRequest(value: unknown): value is IamCreateRoleRequest {
  return shape(value, ['name'], ['description', 'portal']) &&
    matches(value.name, IAM_ROLE_NAME_PATTERN) &&
    optional(value.description, isText(255)) &&
    optional(value.portal, (portal) => matches(portal, IAM_PORTAL_PATTERN));
}

export function isIamUpdateRoleRequest(value: unknown): value is IamUpdateRoleRequest {
  return shape(value, [], ['description', 'portal']) &&
    optional(value.description, isText(255)) &&
    optional(value.portal, (portal) => portal === '' || matches(portal, IAM_PORTAL_PATTERN));
}

export function isIamCreatePermissionRequest(value: unknown): value is IamCreatePermissionRequest {
  return shape(value, ['name', 'description'], []) &&
    isIamPermissionName(value.name) &&
    isText(255)(value.description);
}

export function isIamUpdatePermissionRequest(value: unknown): value is IamUpdatePermissionRequest {
  return shape(value, ['description'], []) && isText(255)(value.description);
}

const CLIENT_URI_FIELDS = ['redirectUris', 'webOrigins', 'postLogoutRedirectUris'] as const;

export function isIamCreateClientRequest(value: unknown): value is IamCreateClientRequest {
  return shape(value, ['clientId', 'type'], ['name', 'description', 'enabled', 'serviceAccountsEnabled', ...CLIENT_URI_FIELDS]) &&
    matches(value.clientId, IAM_CLIENT_ID_PATTERN) &&
    (value.type === 'PUBLIC' || value.type === 'CONFIDENTIAL') &&
    optional(value.name, isText(255)) &&
    optional(value.description, isText(255)) &&
    optional(value.enabled, isBoolean) &&
    optional(value.serviceAccountsEnabled, isBoolean) &&
    CLIENT_URI_FIELDS.every((field) => optional(value[field], isUriList));
}

export function isIamUpdateClientRequest(value: unknown): value is IamUpdateClientRequest {
  return shape(value, [], ['name', 'description', 'enabled', ...CLIENT_URI_FIELDS]) &&
    optional(value.name, isText(255)) &&
    optional(value.description, isText(255)) &&
    optional(value.enabled, isBoolean) &&
    CLIENT_URI_FIELDS.every((field) => optional(value[field], isUriList));
}

// ---- helpers --------------------------------------------------------------------------------------------

type Body = Record<string, unknown>;

/** A plain object with every required key and no key outside `required` + `optionalKeys`. */
function shape(value: unknown, required: readonly string[], optionalKeys: readonly string[]): value is Body {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const allowed = new Set([...required, ...optionalKeys]);
  return Object.keys(value).every((key) => allowed.has(key)) &&
    required.every((key) => (value as Body)[key] !== undefined);
}

function optional(value: unknown, check: (value: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function isText(maxLength: number, minLength = 0): (value: unknown) => value is string {
  return (value: unknown): value is string =>
    typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUniqueList(value: unknown, min: number, max: number, item: (value: unknown) => boolean): boolean {
  return Array.isArray(value) && value.length >= min && value.length <= max &&
    value.every(item) && new Set(value).size === value.length;
}

function isUriList(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 50 && value.every(isText(500, 1));
}
