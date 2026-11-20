import { describe, expect, it } from 'vitest';

import { IAM_OPERATIONS, matchIamOperation, validateIamQuery } from './iam-operations';

const USER = '6acb7476-663d-4c94-b3bd-9e5ac6db7f31';

describe('IAM operation table (IAM-015)', () => {
  it('covers every IAM operation of the auth-service contract once', () => {
    const keys = IAM_OPERATIONS.map((operation) =>
      `${operation.method} ${operation.segments.map((segment) => typeof segment === 'string' ? segment : `{${segment.param}}`).join('/')}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(26);
    expect(IAM_OPERATIONS.every((operation) => /^iam:(users|roles|clients|audit):(read|write)$/.test(operation.permission)))
      .toBe(true);
    // Writes need a write permission, reads a read permission.
    for (const operation of IAM_OPERATIONS) {
      expect(operation.permission.endsWith(operation.method === 'GET' ? ':read' : ':write')).toBe(true);
    }
  });

  it('maps paths to auth-service paths, encoding identifiers', () => {
    expect(matchIamOperation('GET', ['users', USER, 'roles'])).toMatchObject({
      kind: 'operation', upstreamPath: `/admin/iam/users/${USER}/roles`, operation: { permission: 'iam:users:read' },
    });
    expect(matchIamOperation('DELETE', ['permissions', 'reports:export'])).toMatchObject({
      kind: 'operation', upstreamPath: '/admin/iam/permissions/reports%3Aexport',
    });
    expect(matchIamOperation('GET', ['roles', 'default-roles-uatf-dss-realm'])).toMatchObject({ kind: 'operation' });
    expect(matchIamOperation('POST', ['clients', 'portal-becas', 'secret'])).toMatchObject({
      kind: 'operation', operation: { secret: true },
    });
  });

  it('prefers literal segments over identifiers', () => {
    expect(matchIamOperation('POST', ['users', 'resync'])).toMatchObject({
      kind: 'operation', upstreamPath: '/admin/iam/users/resync',
    });
    expect(matchIamOperation('GET', ['permissions', 'matrix'])).toMatchObject({
      kind: 'operation', upstreamPath: '/admin/iam/permissions/matrix',
    });
  });

  it('rejects invalid identifiers and unknown routes or methods', () => {
    expect(matchIamOperation('PATCH', ['users', 'not-a-uuid'])).toEqual({ kind: 'invalid-param', param: 'userId' });
    expect(matchIamOperation('PATCH', ['permissions', 'NOT VALID'])).toEqual({ kind: 'invalid-param', param: 'permissionName' });
    expect(matchIamOperation('GET', ['roles', '../users'])).toEqual({ kind: 'invalid-param', param: 'roleName' });
    expect(matchIamOperation('GET', ['users'])).toEqual({ kind: 'not-found' });
    expect(matchIamOperation('DELETE', ['clients', 'portal-becas'])).toEqual({ kind: 'not-found' });
    expect(matchIamOperation('GET', ['roles', 'DECANO', 'permissions', 'x'])).toEqual({ kind: 'not-found' });
    expect(matchIamOperation('GET', [])).toEqual({ kind: 'not-found' });
  });

  it('accepts only declared, valid, single-valued query parameters', () => {
    const audit = IAM_OPERATIONS.find((operation) => operation.segments[0] === 'audit');
    const clients = IAM_OPERATIONS.find((operation) => operation.method === 'GET' && operation.segments.join() === 'clients');
    const roles = IAM_OPERATIONS.find((operation) => operation.method === 'GET' && operation.segments.join() === 'roles');
    if (!audit || !clients || !roles) throw new Error('missing operations');

    expect(validateIamQuery(audit, new URLSearchParams('targetType=USER&outcome=FAILURE&from=2026-11-01T00:00:00Z&page=0&size=100'))
      ?.toString()).toBe('targetType=USER&outcome=FAILURE&from=2026-11-01T00%3A00%3A00Z&page=0&size=100');
    expect(validateIamQuery(audit, new URLSearchParams('size=101'))).toBeNull();
    expect(validateIamQuery(audit, new URLSearchParams('targetType=GROUP'))).toBeNull();
    expect(validateIamQuery(audit, new URLSearchParams('from=yesterday'))).toBeNull();
    expect(validateIamQuery(audit, new URLSearchParams('page=0&page=1'))).toBeNull();
    expect(validateIamQuery(clients, new URLSearchParams('search=portal&size=200'))).not.toBeNull();
    expect(validateIamQuery(clients, new URLSearchParams('size=201'))).toBeNull();
    expect(validateIamQuery(roles, new URLSearchParams(''))).not.toBeNull();
    expect(validateIamQuery(roles, new URLSearchParams('force=true'))).toBeNull();
  });
});
