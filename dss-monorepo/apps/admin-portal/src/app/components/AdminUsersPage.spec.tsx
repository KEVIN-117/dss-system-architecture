import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getAcademicCatalog: vi.fn(),
  listAdminUsers: vi.fn(),
  replaceAdminUserContexts: vi.fn(),
}));
const iam = vi.hoisted(() => ({
  createIamUser: vi.fn(),
  getIamUserPermissions: vi.fn(),
  getIamUserRoles: vi.fn(),
  listIamPermissions: vi.fn(),
  listIamRoles: vi.fn(),
  replaceIamUserPermissions: vi.fn(),
  replaceIamUserRoles: vi.fn(),
  sendIamActionsEmail: vi.fn(),
  setIamUserEnabled: vi.fn(),
}));
const { useHasPermission } = vi.hoisted(() => ({ useHasPermission: vi.fn() }));

vi.mock('../data-access/auth-admin', () => auth);
vi.mock('../data-access/iam-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-users')>()),
  ...iam,
}));
vi.mock('@dss-monorepo/rbac', () => ({ useHasPermission }));

import { AdminUsersPage } from './AdminUsersPage';
import type { AcademicCatalog, AdminUserDirectoryEntry } from '../data-access/auth-admin';

const director: AdminUserDirectoryEntry = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  username: 'ana.directora',
  email: 'ana@example.edu',
  firstName: 'Ana',
  lastName: 'García',
  isActive: true,
  roles: ['DIRECTOR'],
  academicScope: 'CAREER',
  academicContexts: [
    { id: 'context-1', userId: '123e4567-e89b-42d3-a456-426614174000', facultyId: 4, careerId: '101' },
    { id: 'context-2', userId: '123e4567-e89b-42d3-a456-426614174000', facultyId: 8, careerId: '202' },
  ],
};

const decano: AdminUserDirectoryEntry = {
  id: '223e4567-e89b-42d3-a456-426614174000',
  username: 'luis.decano',
  email: 'luis@example.edu',
  firstName: 'Luis',
  lastName: 'Mamani',
  isActive: false,
  roles: ['DECANO'],
  academicScope: 'FACULTY',
  academicContexts: [],
};

const catalog: AcademicCatalog = {
  faculties: [
    { id: 4, name: 'Ingeniería' },
    { id: 6, name: 'Ciencias Puras' },
    { id: 8, name: 'Ciencias Empresariales' },
  ],
  careers: [
    { id: '101', name: 'Sistemas', facultyId: 4 },
    { id: '202', name: 'Auditoría', facultyId: 8 },
  ],
};

function pageResult(
  content: AdminUserDirectoryEntry[] = [director],
  overrides: Partial<{ totalElements: number; totalPages: number }> = {},
) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useHasPermission.mockReturnValue(true);
  auth.listAdminUsers.mockResolvedValue(pageResult());
  auth.getAcademicCatalog.mockResolvedValue(catalog);
  iam.listIamRoles.mockResolvedValue([
    { name: 'DECANO', description: 'Decano', portal: 'decano', system: true },
    { name: 'DIRECTOR', description: 'Director', portal: 'director', system: true },
  ]);
  iam.getIamUserRoles.mockResolvedValue({ direct: [], effective: [] });
});

describe('AdminUsersPage', () => {
  it('loads users, every academic context and actions in a paginated table', async () => {
    auth.listAdminUsers.mockResolvedValue(pageResult([director, decano], { totalElements: 27, totalPages: 2 }));
    render(<AdminUsersPage />);

    expect(await screen.findByText('Ana García')).toBeTruthy();
    const anaRow = screen.getByRole('row', { name: /Ana García/ });
    expect(within(anaRow).getByText('DIRECTOR')).toBeTruthy();
    expect(await within(anaRow).findByText('Ingeniería · Sistemas')).toBeTruthy();
    expect(within(anaRow).getByText('Ciencias Empresariales · Auditoría')).toBeTruthy();
    expect(within(anaRow).getByText('Activo')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Luis Mamani/ })).getByText('Inactivo')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–20 de 27')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Página siguiente' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Gestionar a ana.directora' })).toBeTruthy();
  });

  it('applies search and role filters, then resets to the first page', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Ana García');
    fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'luis' } });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'DECANO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(auth.listAdminUsers).toHaveBeenLastCalledWith(
        { q: 'luis', role: 'DECANO', active: undefined, page: 0, size: 20 },
        expect.any(AbortSignal),
      ),
    );
  });

  it('hides every write action without iam:users:write', async () => {
    useHasPermission.mockReturnValue(false);
    render(<AdminUsersPage />);
    await screen.findByText('Ana García');

    expect(useHasPermission).toHaveBeenCalledWith('iam:users:write');
    expect(screen.queryByRole('button', { name: 'Nuevo usuario' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar a ana.directora' }));
    expect(await screen.findByText(/Vista de solo lectura/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Desactivar usuario' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reenviar invitación' })).toBeNull();
  });

  it('creates a user and opens its roles to finish the set-up', async () => {
    iam.createIamUser.mockResolvedValue({
      id: '323e4567-e89b-42d3-a456-426614174000', username: 'nuevo.usuario', email: 'nuevo@uatf.edu.bo',
      firstName: 'Nuevo', lastName: 'Usuario', enabled: true, emailVerified: false, createdAt: null, invitationSent: true, academicScope: 'NONE',
    });
    render(<AdminUsersPage />);
    await screen.findByText('Ana García');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    const form = within(await screen.findByRole('dialog', { name: 'Nuevo usuario' }));
    fireEvent.change(form.getByLabelText(/^Usuario/), { target: { value: 'nuevo.usuario' } });
    fireEvent.change(form.getByLabelText(/^Correo electrónico/), { target: { value: 'nuevo@uatf.edu.bo' } });
    fireEvent.change(form.getByLabelText('Nombres'), { target: { value: 'Nuevo' } });
    fireEvent.click(form.getByRole('button', { name: 'Crear usuario' }));

    await waitFor(() => expect(iam.createIamUser).toHaveBeenCalledWith({
      username: 'nuevo.usuario', email: 'nuevo@uatf.edu.bo', firstName: 'Nuevo', lastName: '', sendInvitation: true,
    }));
    expect(await screen.findByText('Usuario @nuevo.usuario creado. Se le envió la invitación por correo.')).toBeTruthy();
    expect(await screen.findByRole('checkbox', { name: 'DIRECTOR' })).toBeTruthy();
    expect(iam.getIamUserRoles).toHaveBeenCalledWith('323e4567-e89b-42d3-a456-426614174000', expect.any(AbortSignal));
    expect(auth.listAdminUsers).toHaveBeenCalledTimes(2);
  });

  it('warns when the user was created but the invitation could not be sent', async () => {
    iam.createIamUser.mockResolvedValue({
      id: '323e4567-e89b-42d3-a456-426614174000', username: 'sin.correo', email: 'x@uatf.edu.bo',
      firstName: null, lastName: null, enabled: true, emailVerified: false, createdAt: null, invitationSent: false, academicScope: 'NONE',
    });
    render(<AdminUsersPage />);
    await screen.findByText('Ana García');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    const form = within(await screen.findByRole('dialog', { name: 'Nuevo usuario' }));
    fireEvent.change(form.getByLabelText(/^Usuario/), { target: { value: 'sin.correo' } });
    fireEvent.change(form.getByLabelText(/^Correo electrónico/), { target: { value: 'x@uatf.edu.bo' } });
    fireEvent.click(form.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText(/no se pudo enviar la invitación/)).toBeTruthy();
  });

  it('updates the row when the account is deactivated from the panel', async () => {
    iam.setIamUserEnabled.mockResolvedValue({ ...director, enabled: false });
    render(<AdminUsersPage />);
    await screen.findByText('Ana García');

    fireEvent.click(screen.getByRole('button', { name: 'Gestionar a ana.directora' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar usuario' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));

    await waitFor(() => expect(iam.setIamUserEnabled).toHaveBeenCalledWith(director.id, false));
    // The modal sheet hides the table from the accessibility tree while it is open.
    const row = screen.getByRole('row', { name: /Ana García/, hidden: true });
    await waitFor(() => expect(within(row).getByText('Inactivo')).toBeTruthy());
  });

  it('shows empty and error states accessibly', async () => {
    auth.listAdminUsers.mockResolvedValueOnce(pageResult([], { totalElements: 0, totalPages: 0 }));
    const { unmount } = render(<AdminUsersPage />);
    expect(await screen.findByText('No hay usuarios que coincidan con estos filtros.')).toBeTruthy();
    unmount();

    auth.listAdminUsers.mockRejectedValueOnce(new Error('Auth Service no disponible'));
    render(<AdminUsersPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('Auth Service no disponible');
  });
});
