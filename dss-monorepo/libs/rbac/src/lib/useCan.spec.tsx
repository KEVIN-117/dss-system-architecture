import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@dss-monorepo/auth';

import { useHasPermission, useHasRole } from './useCan';

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

  it('evaluates effective permissions without giving academic analytics to SUPERADMIN', () => {
    mockedUseAuth.mockReturnValue(authState(['SUPERADMIN']));
    const { result, rerender } = renderHook(() => useHasPermission('analytics:global'));

    expect(result.current).toBe(false);

    mockedUseAuth.mockReturnValue(authState(['SUPERADMIN']));
    rerender();
    expect(renderHook(() => useHasPermission('pipelines:execute')).result.current).toBe(true);
  });
});

function authState(
  roles: ('SUPERADMIN' | 'RECTOR' | 'DECANO' | 'DIRECTOR')[],
  isAuthenticated = true,
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
    permissions: [],
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    getToken: vi.fn(),
    getUser: vi.fn(),
    hasRole: vi.fn(),
    hasPermission: vi.fn(),
  };
}
