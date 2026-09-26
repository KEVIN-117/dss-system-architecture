import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuth } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('./AuthProvider', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe('ProtectedRoute', () => {
  it('does not leave an unauthenticated user in a loading state', () => {
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
      <ProtectedRoute unauthorizedFallback={<p>Sin acceso</p>}>
        <p>Contenido</p>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Sin acceso')).toBeTruthy();
    expect(screen.queryByText('Contenido')).toBeNull();
  });
});
