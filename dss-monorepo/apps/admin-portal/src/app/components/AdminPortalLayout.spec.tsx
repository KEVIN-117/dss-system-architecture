import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { useAuth, push } = vi.hoisted(() => ({ useAuth: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push }) }));
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
    onNavigate,
    children,
  }: {
    navGroups: { title: string; items: { title: string; href: string }[] }[];
    onNavigate?: (href: string) => void;
    children: ReactNode;
  }) => (
    <div>
      <nav>
        {navGroups.flatMap((group) =>
          group.items.map((item) => (
            <button key={item.title} type="button" onClick={() => onNavigate?.(item.href)}>
              {item.title}
            </button>
          )),
        )}
      </nav>
      {children}
    </div>
  ),
}));

// The header indicator polls the BFF; its own spec covers it.
vi.mock('./etl/EtlRunningIndicator', () => ({ EtlRunningIndicator: () => null }));

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
    expect(screen.queryByText('Cierres académicos')).toBeNull();
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

  it('shows applications and audit only with their own permissions', () => {
    useAuth.mockReturnValue(session([], ['iam:audit:read']));
    render(<AdminPortalLayout access={ADMIN_PERMISSIONS.audit}><p>auditoría</p></AdminPortalLayout>);

    expect(screen.getByText('auditoría')).toBeTruthy();
    expect(screen.getByText('Auditoría')).toBeTruthy();
    expect(screen.queryByText('Aplicaciones')).toBeNull();
    expect(screen.queryByText('Roles')).toBeNull();
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

  it('opens DW pages with their dw:* permissions only (IAM-019)', () => {
    useAuth.mockReturnValue(session([], ['dw:etl-monitor:read']));
    const { unmount } = render(<AdminPortalLayout access={ADMIN_PERMISSIONS.etl}><p>ejecuciones</p></AdminPortalLayout>);

    expect(screen.getByText('ejecuciones')).toBeTruthy();
    expect(screen.getByText('Ejecuciones ETL')).toBeTruthy();
    // LM-007: the Load Manager pages live in the dw-control-service group and open with the monitor permission.
    expect(screen.getByText('Panel ETL')).toBeTruthy();
    expect(screen.getByText('Programaciones ETL')).toBeTruthy();
    expect(screen.queryByText('Cierres académicos')).toBeNull();
    expect(screen.getByText('Resumen general')).toBeTruthy();
    unmount();

    // Without the permission the page is denied: the retired DW_* roles no longer exist to fall back on.
    useAuth.mockReturnValue(session(['SUPERADMIN'], ['iam:users:read']));
    render(<AdminPortalLayout access={ADMIN_PERMISSIONS.closures}><p>cierres</p></AdminPortalLayout>);
    expect(screen.getByText('Acceso restringido')).toBeTruthy();
    expect(screen.queryByText('cierres')).toBeNull();
  });

  it('navigates the sidebar client-side so the session is not re-verified', () => {
    useAuth.mockReturnValue(session([], ['iam:users:read', 'iam:roles:read']));
    render(<AdminPortalLayout><p>contenido</p></AdminPortalLayout>);

    fireEvent.click(screen.getByText('Roles'));

    expect(push).toHaveBeenCalledWith('/roles');
  });
});
