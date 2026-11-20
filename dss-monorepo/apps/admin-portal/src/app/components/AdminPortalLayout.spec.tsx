import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@dss-monorepo/auth', () => ({
  useAuth,
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  LandingLoginRedirect: () => null,
}));
vi.mock('@dss-monorepo/design-system', () => ({
  AccessDenied: () => <p>Acceso restringido</p>,
  Loader: () => null,
  DashboardTemplate: ({
    navGroups,
    children,
  }: {
    navGroups: { title: string; items: { title: string }[] }[];
    children: ReactNode;
  }) => (
    <div>
      <nav>{navGroups.flatMap((group) => group.items.map((item) => <span key={item.title}>{item.title}</span>))}</nav>
      {children}
    </div>
  ),
}));

import { ADMIN_PERMISSIONS, AdminPortalLayout } from './AdminPortalLayout';

function session(roles: string[], permissions: string[]) {
  return {
    user: {
      id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
      username: 'ana',
      email: 'ana@uatf.edu.bo',
      firstName: 'Ana',
      lastName: 'Admin',
      isActive: true,
      academicContexts: [],
      roles,
    },
    permissions,
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  };
}

afterEach(() => vi.clearAllMocks());

/** IAM-014: the admin portal follows token permissions, not the SUPERADMIN role. */
describe('AdminPortalLayout', () => {
  it('shows only the sections the permissions open', () => {
    useAuth.mockReturnValue(session([], ['iam:users:read']));
    render(<AdminPortalLayout><p>contenido</p></AdminPortalLayout>);

    expect(screen.getByText('contenido')).toBeTruthy();
    expect(screen.getByText('Usuarios')).toBeTruthy();
    expect(screen.getByText('Resumen general')).toBeTruthy();
    expect(screen.queryByText('Conexiones')).toBeNull();
    expect(screen.queryByText('Operaciones ML')).toBeNull();
    expect(screen.getByText('Cierres académicos')).toBeTruthy();
  });

  it('opens roles, permissions and the matrix with iam:roles:read alone', () => {
    useAuth.mockReturnValue(session([], ['iam:roles:read']));
    render(<AdminPortalLayout access={ADMIN_PERMISSIONS.roles}><p>roles</p></AdminPortalLayout>);

    expect(screen.getByText('roles')).toBeTruthy();
    expect(screen.getByText('Roles')).toBeTruthy();
    expect(screen.getByText('Permisos')).toBeTruthy();
    expect(screen.getByText('Matriz de acceso')).toBeTruthy();
    expect(screen.queryByText('Usuarios')).toBeNull();
  });

  it('denies a page to SUPERADMIN when the token lacks its permission', () => {
    useAuth.mockReturnValue(session(['SUPERADMIN'], ['iam:users:read']));
    render(<AdminPortalLayout access={ADMIN_PERMISSIONS.ml}><p>modelos</p></AdminPortalLayout>);

    expect(screen.getByText('Acceso restringido')).toBeTruthy();
    expect(screen.queryByText('modelos')).toBeNull();
  });

  it('opens a page with its permission even without any portal role', () => {
    useAuth.mockReturnValue(session([], ['prediction:train']));
    render(<AdminPortalLayout access={ADMIN_PERMISSIONS.ml}><p>modelos</p></AdminPortalLayout>);

    expect(screen.getByText('modelos')).toBeTruthy();
    expect(screen.getByText('Operaciones ML')).toBeTruthy();
    expect(screen.queryByText('Usuarios')).toBeNull();
  });

  it('leaves DW pages to the service for any authenticated user', () => {
    useAuth.mockReturnValue(session([], []));
    render(<AdminPortalLayout access="authenticated"><p>cierres</p></AdminPortalLayout>);

    expect(screen.getByText('cierres')).toBeTruthy();
    expect(screen.queryByText('Resumen general')).toBeNull();
  });
});
