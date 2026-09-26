import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from '@dss-monorepo/auth';

import { Can } from './Can';

vi.mock('@dss-monorepo/auth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe('Can', () => {
  it('renders a fallback while loading and fails closed without a session', () => {
    mockedUseAuth.mockReturnValue(authState({ isLoading: true }));
    const { rerender } = render(
      <Can role="RECTOR" loadingFallback={<p>Cargando</p>} fallback={<p>Sin acceso</p>}>
        <p>Contenido</p>
      </Can>,
    );
    expect(screen.getByText('Cargando')).toBeTruthy();

    mockedUseAuth.mockReturnValue(authState({ isAuthenticated: false }));
    rerender(
      <Can not role="DIRECTOR" fallback={<p>Sin acceso</p>}>
        <p>Contenido</p>
      </Can>,
    );
    expect(screen.getByText('Sin acceso')).toBeTruthy();
  });

  it('renders children for granted permissions and fallbacks for denied permissions', () => {
    mockedUseAuth.mockReturnValue(authState({ roles: ['RECTOR'] }));
    const { rerender } = render(
      <Can permission="analytics:global">
        <p>Métricas institucionales</p>
      </Can>,
    );
    expect(screen.getByText('Métricas institucionales')).toBeTruthy();

    mockedUseAuth.mockReturnValue(authState({ roles: ['SUPERADMIN'] }));
    rerender(
      <Can permission="analytics:global" fallback={<p>Sin analítica</p>}>
        <p>Métricas institucionales</p>
      </Can>,
    );
    expect(screen.getByText('Sin analítica')).toBeTruthy();
  });

  it('supports all-match and render props', () => {
    mockedUseAuth.mockReturnValue(authState({ roles: ['RECTOR'] }));
    render(
      <Can roles={['DECANO', 'DIRECTOR']} match="all">
        {(allowed) => <p>{allowed ? 'Puede combinar' : 'Sin acceso'}</p>}
      </Can>,
    );
    expect(screen.getByText('Puede combinar')).toBeTruthy();
  });
});

function authState({
  isAuthenticated = true,
  isLoading = false,
  roles = ['DIRECTOR'],
}: {
  isAuthenticated?: boolean;
  isLoading?: boolean;
  roles?: ('SUPERADMIN' | 'RECTOR' | 'DECANO' | 'DIRECTOR')[];
}) {
  return {
    isAuthenticated,
    isLoading,
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
