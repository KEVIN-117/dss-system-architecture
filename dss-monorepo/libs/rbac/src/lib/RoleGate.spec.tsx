import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@dss-monorepo/auth';

import { RoleGate } from './RoleGate';

vi.mock('@dss-monorepo/auth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe('RoleGate', () => {
  it('renders the loading fallback before the authentication state is known', () => {
    mockedUseAuth.mockReturnValue(authState({ isLoading: true }));

    render(
      <RoleGate
        roles={['RECTOR']}
        loadingFallback={<p>Cargando permisos</p>}
        fallback={<p>Sin acceso</p>}
      >
        <p>Dashboard</p>
      </RoleGate>,
    );

    expect(screen.getByText('Cargando permisos')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('does not grant an academic role to SUPERADMIN', () => {
    mockedUseAuth.mockReturnValue(authState({ roles: ['SUPERADMIN'] }));

    render(
      <RoleGate roles={['RECTOR']} fallback={<p>Sin acceso</p>}>
        <p>Dashboard académico</p>
      </RoleGate>,
    );

    expect(screen.getByText('Sin acceso')).toBeTruthy();
  });

  it('honours all-role matching when requested', () => {
    mockedUseAuth.mockReturnValue(authState({ roles: ['RECTOR'] }));

    render(
      <RoleGate roles={['DECANO', 'DIRECTOR']} match="all" fallback={<p>Sin acceso</p>}>
        <p>Dashboard</p>
      </RoleGate>,
    );

    expect(screen.getByText('Dashboard')).toBeTruthy();
  });
});

function authState({
  isLoading = false,
  roles = ['DIRECTOR'],
}: {
  isLoading?: boolean;
  roles?: ('SUPERADMIN' | 'RECTOR' | 'DECANO' | 'DIRECTOR')[];
}) {
  return {
    isAuthenticated: true,
    isLoading,
    error: null,
    user: {
      id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
      username: 'maria',
      email: 'maria@uatf.edu.bo',
      firstName: 'María',
      lastName: 'Pérez',
      isActive: true,
      academicContexts: [],
      roles,
    },
    token: 'access-token',
    lastLogin: new Date(),
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
