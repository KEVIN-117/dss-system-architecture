import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const access = vi.hoisted(() => ({
  listRoles: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));
const { useHasPermission } = vi.hoisted(() => ({ useHasPermission: vi.fn() }));
vi.mock('../data-access/iam-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-access')>()),
  ...access,
}));
vi.mock('@dss-monorepo/rbac', () => ({ useHasPermission }));

import { IamRequestError } from '../data-access/iam-users';
import { AdminRolesPage } from './AdminRolesPage';

beforeEach(() => {
  vi.clearAllMocks();
  useHasPermission.mockReturnValue(true);
  access.listRoles.mockResolvedValue([
    { name: 'RECTOR', description: 'Rector', portal: 'rector', system: true },
    { name: 'AUDITOR', description: 'Auditor externo', portal: null, system: false },
  ]);
});

describe('AdminRolesPage', () => {
  it('lists roles sorted, with portal and system badge', async () => {
    render(<AdminRolesPage />);
    const table = await screen.findByRole('table', { name: 'Roles del realm' });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows[0].textContent).toContain('AUDITOR');
    expect(rows[0].textContent).toContain('Sin portal');
    expect(rows[1].textContent).toContain('Sistema');
    expect(screen.getByRole('button', { name: 'Eliminar RECTOR' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Eliminar AUDITOR' })).toHaveProperty('disabled', false);
  });

  it('hides write actions without iam:roles:write', async () => {
    useHasPermission.mockReturnValue(false);
    render(<AdminRolesPage />);
    await screen.findByText('AUDITOR');

    expect(useHasPermission).toHaveBeenCalledWith('iam:roles:write');
    expect(screen.queryByRole('button', { name: 'Nuevo rol' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar AUDITOR' })).toBeNull();
  });

  it('validates the name and creates a role', async () => {
    access.createRole.mockResolvedValue({ name: 'VICERRECTOR', description: 'Vice', portal: 'rector', system: false });
    render(<AdminRolesPage />);
    await screen.findByText('AUDITOR');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo rol' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo rol' });
    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear rol' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('MAYÚSCULAS');
    expect(access.createRole).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'vicerrector' } });
    fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Vice' } });
    fireEvent.change(within(dialog).getByLabelText('Portal'), { target: { value: 'rector' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear rol' }));

    await waitFor(() => expect(access.createRole).toHaveBeenCalledWith({ name: 'VICERRECTOR', description: 'Vice', portal: 'rector' }));
    expect((await screen.findByRole('status')).textContent).toContain('Rol VICERRECTOR creado');
    expect(access.listRoles).toHaveBeenCalledTimes(2);
  });

  it('edits description and portal of an existing role', async () => {
    access.updateRole.mockResolvedValue({ name: 'AUDITOR', description: 'Nueva', portal: '', system: false });
    render(<AdminRolesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar AUDITOR' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar AUDITOR' });

    expect(within(dialog).queryByLabelText(/Nombre/)).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Nueva' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(access.updateRole).toHaveBeenCalledWith('AUDITOR', { description: 'Nueva', portal: '' }));
  });

  it('warns when the role is in use and deletes it only on a second confirmation', async () => {
    access.deleteRole
      .mockRejectedValueOnce(new IamRequestError('El rol AUDITOR está asignado a 3 usuarios', 409))
      .mockResolvedValueOnce(undefined);
    render(<AdminRolesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar AUDITOR' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar el rol AUDITOR?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('asignado a 3 usuarios');
    expect(within(dialog).getByRole('heading', { name: 'El rol está en uso' })).toBeTruthy();
    expect(access.deleteRole).toHaveBeenCalledWith('AUDITOR', false);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar de todas formas' }));
    await waitFor(() => expect(access.deleteRole).toHaveBeenLastCalledWith('AUDITOR', true));
    expect((await screen.findByRole('status')).textContent).toContain('Rol AUDITOR eliminado');
    expect(screen.queryByText('Auditor externo')).toBeNull();
  });
});
