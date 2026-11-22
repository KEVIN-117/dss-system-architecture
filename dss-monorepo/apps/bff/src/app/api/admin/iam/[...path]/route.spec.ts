import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, callAuthServiceIam, getBffAuthConfig } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  callAuthServiceIam: vi.fn(),
  getBffAuthConfig: vi.fn(() => ({ authServiceUrl: 'http://auth-service:8000' })),
}));

vi.mock('../../../_lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../_lib/auth-guard')>()),
  authenticateRequest,
}));
vi.mock('@dss-monorepo/auth-connector', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dss-monorepo/auth-connector')>()),
  callAuthServiceIam,
}));
vi.mock('../../../../../lib/bff-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../lib/bff-config')>()),
  getBffAuthConfig,
}));

import { AuthServiceClientError, AuthServiceIamError } from '@dss-monorepo/auth-connector';
import { BffConfigurationError } from '../../../../../lib/bff-config';
import { IAM_OPERATIONS, type IamOperation } from '../../../_lib/iam-operations';
import { DELETE, GET, PATCH, POST, PUT } from './route';

const HANDLERS = { GET, POST, PUT, PATCH, DELETE } as const;
const USER = '6acb7476-663d-4c94-b3bd-9e5ac6db7f31';
const PARAMS = { userId: USER, roleName: 'VICERRECTOR', permissionName: 'reports:export', clientId: 'portal-becas' };

/** A valid body for every operation that takes one. */
const BODIES: Record<string, unknown> = {
  'POST users': { username: 'ana.perez', email: 'ana@uatf.edu.bo' },
  'PATCH users/{userId}': { enabled: false },
  'POST users/{userId}/actions-email': { actions: ['UPDATE_PASSWORD'] },
  'PUT users/{userId}/roles': { roles: ['DECANO'] },
  'PUT users/{userId}/permissions': { permissions: ['dw:closure:read'] },
  'POST roles': { name: 'VICERRECTOR', portal: 'rector' },
  'PATCH roles/{roleName}': { description: 'Vicerrectorado' },
  'PUT roles/{roleName}/permissions': { permissions: ['analytics:read'] },
  'POST permissions': { name: 'reports:export', description: 'Exportar reportes' },
  'PATCH permissions/{permissionName}': { description: 'Exportar reportes institucionales' },
  'POST clients': { clientId: 'portal-becas', type: 'CONFIDENTIAL' },
  'PATCH clients/{clientId}': { name: 'Portal de becas' },
};

function key(operation: IamOperation): string {
  return `${operation.method} ${operation.segments.map((segment) =>
    typeof segment === 'string' ? segment : `{${segment.param}}`).join('/')}`;
}

function pathOf(operation: IamOperation): string[] {
  return operation.segments.map((segment) => typeof segment === 'string' ? segment : PARAMS[segment.param]);
}

function signedIn(permissions: string[]) {
  return {
    authenticated: true as const,
    value: {
      token: 'user-access-token',
      roles: [],
      permissions,
      user: { id: USER, username: 'ana.admin', academicContexts: [], roles: [] },
    },
  };
}

function invoke(operation: IamOperation, options: { body?: unknown; rawBody?: string; query?: string; path?: string[] } = {}) {
  const path = options.path ?? pathOf(operation);
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  const request = new Request(`http://bff/api/admin/iam/${path.join('/')}${options.query ?? ''}`, {
    method: operation.method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body,
  });
  return HANDLERS[operation.method](request, { params: Promise.resolve({ path }) });
}

beforeEach(() => {
  callAuthServiceIam.mockResolvedValue({ status: 200, body: { ok: true } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('/api/admin/iam/** (IAM-015)', () => {
  describe.each(IAM_OPERATIONS.map((operation) => [key(operation), operation] as const))('%s', (_, operation) => {
    const body = BODIES[key(operation)];

    it('forwards to auth-service with the user token when the permission is granted', async () => {
      authenticateRequest.mockResolvedValue(signedIn([operation.permission]));
      callAuthServiceIam.mockResolvedValue({ status: operation.method === 'POST' ? 201 : 200, body: { ok: true } });

      const response = await invoke(operation, { body });

      expect(response.status).toBe(operation.method === 'POST' ? 201 : 200);
      expect(await response.json()).toEqual({ ok: true });
      expect(response.headers.get('cache-control')).toBe('no-store');
      const [url, token, call] = callAuthServiceIam.mock.calls[0];
      expect(url).toBe('http://auth-service:8000');
      expect(token).toBe('user-access-token');
      expect(call).toMatchObject({ method: operation.method, body });
      expect(call.path.startsWith('/admin/iam/')).toBe(true);
    });

    it('denies without the permission and never calls auth-service', async () => {
      const otherPermission = operation.permission.endsWith(':read')
        ? operation.permission.replace(':read', ':write')
        : operation.permission.replace(':write', ':read');
      authenticateRequest.mockResolvedValue(signedIn([otherPermission, 'analytics:global']));

      const response = await invoke(operation, { body });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ requiredPermissions: [operation.permission] });
      expect(callAuthServiceIam).not.toHaveBeenCalled();
    });

    it('maps service errors uniformly', async () => {
      authenticateRequest.mockResolvedValue(signedIn([operation.permission]));

      callAuthServiceIam.mockRejectedValueOnce(new AuthServiceIamError(409, 'IamRuleViolationException', 'Regla de IAM.'));
      const rejected = await invoke(operation, { body });
      expect(rejected.status).toBe(409);
      expect(await rejected.json()).toEqual({
        error: 'IAM request rejected', code: 'IamRuleViolationException', detail: 'Regla de IAM.',
      });

      callAuthServiceIam.mockRejectedValueOnce(new AuthServiceIamError(502, null, null));
      const unavailable = await invoke(operation, { body });
      expect(unavailable.status).toBe(502);
      expect(await unavailable.json()).toEqual({ error: 'Auth service is unavailable', upstreamStatus: 502 });
    });
  });

  it('requires a session before anything else', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    });
    const operation = IAM_OPERATIONS[0];

    expect((await invoke(operation, { body: BODIES[key(operation)] })).status).toBe(401);
    expect(callAuthServiceIam).not.toHaveBeenCalled();
  });

  it('rejects unknown routes, invalid identifiers, queries and bodies before calling auth-service', async () => {
    authenticateRequest.mockResolvedValue(signedIn(['iam:users:read', 'iam:users:write', 'iam:roles:write', 'iam:audit:read']));
    const patchUser = IAM_OPERATIONS.find((operation) => key(operation) === 'PATCH users/{userId}') as IamOperation;
    const deleteRole = IAM_OPERATIONS.find((operation) => key(operation) === 'DELETE roles/{roleName}') as IamOperation;
    const audit = IAM_OPERATIONS.find((operation) => key(operation) === 'GET audit') as IamOperation;

    const notFound = await invoke({ ...audit, method: 'DELETE' });
    expect(notFound.status).toBe(404);
    const badId = await invoke(patchUser, { path: ['users', 'nope'], body: { enabled: false } });
    expect(badId.status).toBe(400);
    expect(await badId.json()).toMatchObject({ code: 'INVALID_PARAMETER' });
    expect((await invoke(deleteRole, { query: '?force=maybe' })).status).toBe(400);
    expect((await invoke(audit, { query: '?unknown=1' })).status).toBe(400);
    const badJson = await invoke(patchUser, { rawBody: '{not json' });
    expect(await badJson.json()).toMatchObject({ code: 'INVALID_JSON' });
    const badBody = await invoke(patchUser, { body: { username: 'renamed' } });
    expect(badBody.status).toBe(400);
    expect(await badBody.json()).toMatchObject({ code: 'INVALID_BODY' });

    expect(callAuthServiceIam).not.toHaveBeenCalled();
  });

  it('forwards validated queries and passes 204 and created secrets through without caching', async () => {
    authenticateRequest.mockResolvedValue(signedIn(['iam:roles:write', 'iam:clients:write', 'iam:audit:read']));
    const deleteRole = IAM_OPERATIONS.find((operation) => key(operation) === 'DELETE roles/{roleName}') as IamOperation;
    const audit = IAM_OPERATIONS.find((operation) => key(operation) === 'GET audit') as IamOperation;
    const rotate = IAM_OPERATIONS.find((operation) => key(operation) === 'POST clients/{clientId}/secret') as IamOperation;

    callAuthServiceIam.mockResolvedValueOnce({ status: 204, body: null });
    const deleted = await invoke(deleteRole, { query: '?force=true' });
    expect(deleted.status).toBe(204);
    expect(callAuthServiceIam.mock.calls[0][2].query.toString()).toBe('force=true');

    await invoke(audit, { query: '?targetType=CLIENT&size=10' });
    expect(callAuthServiceIam.mock.calls[1][2].query.toString()).toBe('targetType=CLIENT&size=10');

    callAuthServiceIam.mockResolvedValueOnce({ status: 200, body: { clientId: 'portal-becas', secret: 'shown-once' } });
    const rotated = await invoke(rotate);
    expect(rotated.headers.get('cache-control')).toBe('no-store');
    expect(await rotated.json()).toEqual({ clientId: 'portal-becas', secret: 'shown-once' });
  });

  it('maps timeouts, unavailability and configuration errors', async () => {
    authenticateRequest.mockResolvedValue(signedIn(['iam:audit:read']));
    const audit = IAM_OPERATIONS.find((operation) => key(operation) === 'GET audit') as IamOperation;

    callAuthServiceIam.mockRejectedValueOnce(new AuthServiceClientError(504, 'timeout'));
    expect((await invoke(audit)).status).toBe(504);
    callAuthServiceIam.mockRejectedValueOnce(new AuthServiceClientError(503, 'down'));
    expect((await invoke(audit)).status).toBe(503);
    callAuthServiceIam.mockRejectedValueOnce(new Error('boom'));
    expect((await invoke(audit)).status).toBe(502);
    getBffAuthConfig.mockImplementationOnce(() => { throw new BffConfigurationError('missing'); });
    expect((await invoke(audit)).status).toBe(500);
  });
});
