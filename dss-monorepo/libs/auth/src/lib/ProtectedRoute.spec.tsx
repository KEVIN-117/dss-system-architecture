import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('./AuthProvider', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe('ProtectedRoute', () => {
  it('renders only the unauthenticated fallback when there is no session', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: 'profile missing',
      user: null,
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
    });

    render(
      <ProtectedRoute unauthenticatedFallback={<p>Sesión requerida</p>}>
        <p>Contenido</p>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Sesión requerida')).toBeTruthy();
    expect(screen.queryByText('Contenido')).toBeNull();
  });

  it('uses the forbidden fallback for the deprecated role API', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      error: null,
      user: {
        id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
        username: 'director',
        email: 'director@uatf.edu.bo',
        firstName: 'Directora',
        lastName: 'DSS',
        isActive: true,
        academicContexts: [],
        roles: ['DIRECTOR'],
      },
      token: null,
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
    });

    render(
      <ProtectedRoute
        requiredRoles={['RECTOR']}
        unauthenticatedFallback={<p>Sesión requerida</p>}
        forbiddenFallback={<p>Acceso no autorizado</p>}
      >
        <p>Contenido</p>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Acceso no autorizado')).toBeTruthy();
    expect(screen.queryByText('Sesión requerida')).toBeNull();
    expect(screen.queryByText('Contenido')).toBeNull();
  });
});
