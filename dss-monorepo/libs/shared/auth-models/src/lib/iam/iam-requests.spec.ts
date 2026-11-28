import { describe, expect, it } from 'vitest';

import {
  isIamActionsEmailRequest,
  isIamCreateClientRequest,
  isIamCreatePermissionRequest,
  isIamCreateRoleRequest,
  isIamCreateUserRequest,
  isIamPermissionName,
  isIamReplacePermissionsRequest,
  isIamReplaceRolePermissionsRequest,
  isIamReplaceRolesRequest,
  isIamUpdateClientRequest,
  isIamUpdatePermissionRequest,
  isIamUpdateRoleRequest,
  isIamUpdateUserRequest,
} from './iam-requests.js';

/** IAM-015: the BFF forwards only bodies that match the auth-service contract. */
describe('IAM request guards', () => {
  it('users', () => {
    expect(isIamCreateUserRequest({ username: 'ana.perez', email: 'ana@uatf.edu.bo' })).toBe(true);
    expect(isIamCreateUserRequest({
      username: 'ana.perez', email: 'ana@uatf.edu.bo', firstName: 'Ana', enabled: false, sendInvitation: false,
    })).toBe(true);
    expect(isIamCreateUserRequest({ username: 'an', email: 'ana@uatf.edu.bo' })).toBe(false);
    expect(isIamCreateUserRequest({ username: 'ana perez', email: 'ana@uatf.edu.bo' })).toBe(false);
    expect(isIamCreateUserRequest({ username: 'ana.perez', email: 'no-email' })).toBe(false);
    expect(isIamCreateUserRequest({ username: 'ana.perez', email: 'ana@uatf.edu.bo', password: 'x' }))
      .toBe(false);
    expect(isIamUpdateUserRequest({})).toBe(true);
    expect(isIamUpdateUserRequest({ enabled: false, lastName: 'Pérez' })).toBe(true);
    expect(isIamUpdateUserRequest({ username: 'renamed' })).toBe(false);
    expect(isIamUpdateUserRequest({ enabled: 'false' })).toBe(false);
  });

  it('required-actions e-mail', () => {
    expect(isIamActionsEmailRequest({ actions: ['UPDATE_PASSWORD'], lifespanHours: 24 })).toBe(true);
    expect(isIamActionsEmailRequest({ actions: [] })).toBe(false);
    expect(isIamActionsEmailRequest({ actions: ['UPDATE_PASSWORD', 'UPDATE_PASSWORD'] })).toBe(false);
    expect(isIamActionsEmailRequest({ actions: ['DELETE_ACCOUNT'] })).toBe(false);
    expect(isIamActionsEmailRequest({ actions: ['VERIFY_EMAIL'], lifespanHours: 721 })).toBe(false);
    expect(isIamActionsEmailRequest({ actions: ['VERIFY_EMAIL'], lifespanHours: 1.5 })).toBe(false);
  });

  it('role and permission assignments', () => {
    expect(isIamReplaceRolesRequest({ roles: [] })).toBe(true);
    expect(isIamReplaceRolesRequest({ roles: ['DECANO', 'DIRECTOR'] })).toBe(true);
    expect(isIamReplaceRolesRequest({ roles: ['DECANO', 'DECANO'] })).toBe(false);
    expect(isIamReplaceRolesRequest({ roles: [''] })).toBe(false);
    expect(isIamReplaceRolesRequest({})).toBe(false);
    expect(isIamReplacePermissionsRequest({ permissions: ['dw:closure:read'] })).toBe(true);
    expect(isIamReplacePermissionsRequest({ permissions: 'dw:closure:read' })).toBe(false);
    expect(isIamReplaceRolePermissionsRequest({ permissions: ['analytics:read', 'reports:export'] })).toBe(true);
    expect(isIamReplaceRolePermissionsRequest({ permissions: ['NOT A PERMISSION'] })).toBe(false);
  });

  it('roles', () => {
    expect(isIamCreateRoleRequest({ name: 'VICERRECTOR', description: 'Vicerrectorado', portal: 'rector' })).toBe(true);
    expect(isIamCreateRoleRequest({ name: 'vicerrector' })).toBe(false);
    expect(isIamCreateRoleRequest({ name: 'VICERRECTOR', portal: 'Rector' })).toBe(false);
    expect(isIamCreateRoleRequest({ name: 'VICERRECTOR', portal: 'becas' })).toBe(false);
    expect(isIamCreateRoleRequest({ name: 'VICERRECTOR' })).toBe(false);
    expect(isIamUpdateRoleRequest({ portal: 'decano' })).toBe(true);
    expect(isIamUpdateRoleRequest({ description: 'Solo descripción' })).toBe(true);
    expect(isIamUpdateRoleRequest({ portal: '' })).toBe(false);
    expect(isIamUpdateRoleRequest({ description: 'x'.repeat(256) })).toBe(false);
    expect(isIamUpdateRoleRequest({ name: 'RENAMED' })).toBe(false);
  });

  it('permissions', () => {
    expect(isIamPermissionName('reports:export')).toBe(true);
    expect(isIamPermissionName('dw:etl-monitor:read')).toBe(true);
    expect(isIamPermissionName('reports')).toBe(false);
    expect(isIamCreatePermissionRequest({ name: 'reports:export', description: 'Exportar' })).toBe(true);
    expect(isIamCreatePermissionRequest({ name: 'reports:export' })).toBe(false);
    expect(isIamUpdatePermissionRequest({ description: 'Exportar reportes' })).toBe(true);
    expect(isIamUpdatePermissionRequest({})).toBe(false);
  });

  it('applications', () => {
    expect(isIamCreateClientRequest({
      clientId: 'portal-becas', type: 'PUBLIC', redirectUris: ['https://becas.uatf.edu.bo/*'],
    })).toBe(true);
    expect(isIamCreateClientRequest({ clientId: 'portal-becas', type: 'CONFIDENTIAL', serviceAccountsEnabled: true }))
      .toBe(true);
    expect(isIamCreateClientRequest({ clientId: 'Portal', type: 'PUBLIC' })).toBe(false);
    expect(isIamCreateClientRequest({ clientId: 'portal-becas', type: 'BEARER_ONLY' })).toBe(false);
    expect(isIamCreateClientRequest({ clientId: 'portal-becas', type: 'PUBLIC', secret: 'x' })).toBe(false);
    expect(isIamCreateClientRequest({
      clientId: 'portal-becas', type: 'PUBLIC', redirectUris: Array.from({ length: 51 }, (_, i) => `https://a/${i}`),
    })).toBe(false);
    expect(isIamUpdateClientRequest({ enabled: false, webOrigins: ['+'] })).toBe(true);
    expect(isIamUpdateClientRequest({ type: 'PUBLIC' })).toBe(false);
  });

  it('rejects anything that is not a plain object', () => {
    for (const guard of [isIamCreateUserRequest, isIamUpdateUserRequest, isIamReplaceRolesRequest, isIamUpdateClientRequest]) {
      expect(guard(null)).toBe(false);
      expect(guard([])).toBe(false);
      expect(guard('{}')).toBe(false);
    }
  });
});
