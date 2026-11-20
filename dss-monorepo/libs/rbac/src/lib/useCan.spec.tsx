import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@dss-monorepo/auth';

import { useHasPermission, useHasRole, useMyPermissions } from './useCan';

vi.mock('@dss-monorepo/auth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe('RBAC convenience hooks', () => {
  it('uses the documented role hierarchy and fails closed without a session', () => {
    mockedUseAuth.mockReturnValue(authState(['RECTOR']));
    const { result, rerender } = renderHook(() => useHasRole('DIRECTOR'));

    expect(result.current).toBe(true);

    mockedUseAuth.mockReturnValue(authState([], false));
    rerender();
    expect(result.current).toBe(false);
  });

  it('reads permissions from the token, not from roles (IAM-014)', () => {
    mockedUseAuth.mockReturnValue(authState(['SUPERADMIN'], true, ['pipelines:execute']));
    const { result } = renderHook(() => useHasPermission('analytics:global'));
    expect(result.current).toBe(false);
    expect(renderHook(() => useHasPermission('pipelines:execute')).result.current).toBe(true);

    // A role alone grants nothing; a new permission works without a code change.
    mockedUseAuth.mockReturnValue(authState(['RECTOR'], true, ['reports:export']));
    expect(renderHook(() => useHasPermission('analytics:global')).result.current).toBe(false);
    expect(renderHook(() => useHasPermission('reports:export')).result.current).toBe(true);
    expect([...renderHook(() => useMyPermissions()).result.current]).toEqual(['reports:export']);
  });

  it('exposes no permissions without a session', () => {
    mockedUseAuth.mockReturnValue({ ...authState([], false), permissions: ['analytics:read'] });
    expect(renderHook(() => useMyPermissions()).result.current.size).toBe(0);
  });
});

function authState(
  roles: ('SUPERADMIN' | 'RECTOR' | 'DECANO' | 'DIRECTOR')[],
  isAuthenticated = true,
  permissions: string[] = [],
) {
  return {
    isAuthenticated,
    isLoading: false,
    error: null,
    user: isAuthenticated ? {
      id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
      username: 'maria',
      email: 'maria@uatf.edu.bo',
      firstName: 'María',
      lastName: 'Pérez',
      isActive: true,
      academicContexts: [],
      roles,
    } : null,
    token: null,
    lastLogin: null,
    isInitialized: true,
    permissions,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    getToken: vi.fn(),
    getUser: vi.fn(),
    hasRole: vi.fn(),
    hasPermission: vi.fn(),
  };
}
