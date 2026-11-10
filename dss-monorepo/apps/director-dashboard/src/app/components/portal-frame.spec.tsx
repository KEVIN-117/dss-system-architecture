import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const nav = vi.hoisted(() => ({ path: '/', push: vi.fn(), mounts: 0, loading: false }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: nav.push }),
}));
vi.mock('@dss-monorepo/auth', () => ({
  useAuth: () => ({
    user: { firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.test' },
    logout: vi.fn(),
  }),
  ProtectedRoute: ({ children, loadingFallback }: { children: ReactNode; loadingFallback: ReactNode }) => <>{nav.loading ? loadingFallback : children}</>,
}));
vi.mock('@dss-monorepo/rbac', () => ({
  RoleGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@dss-monorepo/design-system', async () => {
  const React = await import('react');
  return {
    AccessDenied: () => null,
    Loader: () => <span role="status">Verificando sesión…</span>,
    DashboardTemplate: ({ children }: { children: ReactNode }) => {
      React.useState(() => ++nav.mounts);
      return (
        <div>
          <nav>Menú persistente</nav>
          {children}
        </div>
      );
    },
  };
});
import { PortalBoundary } from './portal-frame';

describe('portal navigation shell', () => {
  it('shows the session loader while authentication is being checked', () => {
    nav.path = '/'; nav.loading = true;
    const view = render(<PortalBoundary><p>Contenido privado</p></PortalBoundary>);
    expect(screen.getByRole('status').textContent).toContain('Verificando sesión');
    expect(screen.queryByText('Contenido privado')).toBeNull();
    view.unmount(); nav.loading = false;
  });
  it('preserves the shell when the active section changes', () => {
    nav.mounts = 0;
    nav.path = '/';
    const view = render(
      <PortalBoundary>
        <p>Resumen</p>
      </PortalBoundary>,
    );
    nav.path = '/reportes/admision';
    view.rerender(
      <PortalBoundary>
        <p>Admisión</p>
      </PortalBoundary>,
    );
    expect(screen.getByText('Menú persistente')).toBeTruthy();
    expect(screen.getByText('Admisión')).toBeTruthy();
    expect(nav.mounts).toBe(1);
    view.unmount();
  });
  it('keeps login outside the authenticated shell', () => {
    nav.path = '/login';
    const view = render(
      <PortalBoundary>
        <p>Acceso</p>
      </PortalBoundary>,
    );
    expect(screen.queryByText('Menú persistente')).toBeNull();
    expect(screen.getByText('Acceso')).toBeTruthy();
    view.unmount();
    nav.path = '/';
  });
});
