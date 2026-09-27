import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('@dss-monorepo/auth', () => authMock);
vi.mock('@dss-monorepo/rbac', () => ({
  getHighestRole: (roles: string[]) => roles[0] ?? null,
}));
vi.mock('@dss-monorepo/design-system', () => ({
  AccessDenied: ({ portalName }: { portalName: string }) => (
    <div role="alert">Acceso no autorizado {portalName}</div>
  ),
}));

import {
  resolvePortalUrl,
  TrafficRouter,
} from '../src/components/auth/TrafficRouter';

describe('TrafficRouter', () => {
  beforeEach(() => {
    authMock.useAuth.mockReset();
  });

  it('accepts only configured absolute HTTP(S) portal URLs', () => {
    expect(
      resolvePortalUrl('RECTOR', { RECTOR: 'https://rector.example.edu/' }),
    ).toBe('https://rector.example.edu/');
    expect(resolvePortalUrl('RECTOR', { RECTOR: '/relative' })).toBeNull();
    expect(
      resolvePortalUrl('RECTOR', { RECTOR: 'javascript:alert(1)' }),
    ).toBeNull();
    expect(resolvePortalUrl('RECTOR', {})).toBeNull();
  });

  it('asks for login when the BFF has no authenticated session', () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      isInitialized: true,
      isLoading: false,
      user: null,
      error: null,
    });

    render(<TrafficRouter />);

    expect(
      screen
        .getByRole('link', { name: 'Volver al inicio de sesión' })
        .getAttribute('href'),
    ).toBe('/login');
  });

  it('shows access denied when a valid session has no DSS role', () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
      user: { roles: [] },
      error: null,
    });

    render(<TrafficRouter />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Acceso no autorizado',
    );
  });

  it('waits for the BFF session before making a routing decision', () => {
    authMock.useAuth.mockReturnValue({
      isAuthenticated: false,
      isInitialized: false,
      isLoading: true,
      user: null,
      error: null,
    });

    render(<TrafficRouter />);

    expect(
      screen.getByRole('heading', { name: 'Verificando sesión' }),
    ).toBeTruthy();
  });
});
