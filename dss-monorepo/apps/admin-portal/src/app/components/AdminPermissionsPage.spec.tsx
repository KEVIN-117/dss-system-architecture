import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const access = vi.hoisted(() => ({
  listPermissions: vi.fn(),
  createPermission: vi.fn(),
  updatePermission: vi.fn(),
  deletePermission: vi.fn(),
}));
const { useHasPermission } = vi.hoisted(() => ({ useHasPermission: vi.fn() }));
vi.mock('../data-access/iam-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-access')>()),
  ...access,
}));
vi.mock('@dss-monorepo/rbac', () => ({ useHasPermission }));

import { IamRequestError } from '../data-access/iam-users';
import { AdminPermissionsPage } from './AdminPermissionsPage';

beforeEach(() => {
  vi.clearAllMocks();
  useHasPermission.mockReturnValue(true);
  access.listPermissions.mockResolvedValue([
    { name: 'iam:users:read', description: 'Ver usuarios', resource: 'iam:users', action: 'read', system: true },
    { name: 'dw:closure:read', description: 'Consultar cierres', resource: 'dw:closure', action: 'read', system: false },
    { name: 'dw:closure:manage', description: 'Gestionar cierres', resource: 'dw:closure', action: 'manage', system: false },
  ]);
});

describe('AdminPermissionsPage', () => {
  it('groups permissions by resource', async () => {
    render(<AdminPermissionsPage />);
    const closures = await screen.findByRole('table', { name: 'Permisos de dw:closure' });

    expect(within(closures).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('table', { name: 'Permisos de iam:users' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['dw:closure', 'iam:users']);
    expect(screen.getByRole('button', { name: 'Eliminar iam:users:read' })).toHaveProperty('disabled', true);
  });

  it('rejects a name that is not recurso:acción and creates a valid one', async () => {
    access.createPermission.mockResolvedValue({ name: 'reports:export', description: 'Exportar', resource: 'reports', action: 'export', system: false });
    render(<AdminPermissionsPage />);
    await screen.findByText('dw:closure:read');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo permiso' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo permiso' });
    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'reports' } });
    fireEvent.change(within(dialog).getByLabelText(/Descripción/), { target: { value: 'Exportar' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear permiso' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('recurso:acción');

    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'Reports:Export' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear permiso' }));

    await waitFor(() => expect(access.createPermission).toHaveBeenCalledWith('reports:export', 'Exportar'));
    expect((await screen.findByRole('status')).textContent).toContain('matriz de acceso');
  });

  it('requires a description', async () => {
    render(<AdminPermissionsPage />);
    await screen.findByText('dw:closure:read');
    fireEvent.click(screen.getByRole('button', { name: 'Editar dw:closure:read' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar dw:closure:read' });
    fireEvent.change(within(dialog).getByLabelText(/Descripción/), { target: { value: '  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Describe');
    expect(access.updatePermission).not.toHaveBeenCalled();
  });

  it('shows the service error when deleting fails for another reason', async () => {
    access.deletePermission.mockRejectedValue(new IamRequestError('Keycloak no responde', 503));
    render(<AdminPermissionsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar dw:closure:manage' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar el permiso dw:closure:manage?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Keycloak no responde');
    expect(within(dialog).queryByRole('button', { name: 'Eliminar de todas formas' })).toBeNull();
  });
});
