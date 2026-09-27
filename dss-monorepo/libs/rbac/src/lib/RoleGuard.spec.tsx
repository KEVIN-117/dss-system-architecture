import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@dss-monorepo/auth';

import { RoleGuard } from './RoleGuard';

vi.mock('@dss-monorepo/auth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe('RoleGuard', () => {
  it('preserves the original rolesAllowed contract through Can', () => {
    mockedUseAuth.mockReturnValue(authState(['RECTOR']));

    render(
      <RoleGuard rolesAllowed={['DECANO']} fallback={<p>Sin acceso</p>}>
        <p>Panel de facultad</p>
      </RoleGuard>,
    );

    expect(screen.getByText('Panel de facultad')).toBeTruthy();
  });

  it('renders the optional fallback when the role is denied', () => {
    mockedUseAuth.mockReturnValue(authState(['DIRECTOR']));

    render(
      <RoleGuard rolesAllowed={['RECTOR']} fallback={<p>Sin acceso</p>}>
        <p>Panel institucional</p>
      </RoleGuard>,
    );

    expect(screen.getByText('Sin acceso')).toBeTruthy();
    expect(screen.queryByText('Panel institucional')).toBeNull();
  });
});

function authState(roles: ('SUPERADMIN' | 'RECTOR' | 'DECANO' | 'DIRECTOR')[]) {
  return {
    isAuthenticated: true,
    isLoading: false,
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
