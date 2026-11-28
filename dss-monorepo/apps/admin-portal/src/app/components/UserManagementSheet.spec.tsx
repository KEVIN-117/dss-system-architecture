import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const iam = vi.hoisted(() => ({
  getIamUserPermissions: vi.fn(),
  getIamUserRoles: vi.fn(),
  listIamPermissions: vi.fn(),
  listIamRoles: vi.fn(),
  replaceIamUserPermissions: vi.fn(),
  replaceIamUserRoles: vi.fn(),
  sendIamActionsEmail: vi.fn(),
  setIamUserEnabled: vi.fn(),
}));
vi.mock('../data-access/iam-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-users')>()),
  ...iam,
}));
vi.mock('../data-access/auth-admin', () => ({
  getAcademicCatalog: vi.fn().mockResolvedValue({ faculties: [], careers: [] }),
  replaceAdminUserContexts: vi.fn(),
}));

import { IamRequestError } from '../data-access/iam-users';
import type { AdminUserDirectoryEntry } from '../data-access/auth-admin';
import { UserManagementSheet, type UserManagementTab } from './UserManagementSheet';

const user: AdminUserDirectoryEntry = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  username: 'ana.directora',
  email: 'ana@example.edu',
  firstName: 'Ana',
  lastName: 'García',
  isActive: true,
  roles: ['DIRECTOR'],
  academicScope: 'CAREER',
  academicContexts: [],
};

function open(tab: UserManagementTab = 'account', canWrite = true, target = user) {
  const onChanged = vi.fn();
  render(
    <UserManagementSheet user={target} canWrite={canWrite} initialTab={tab} onClose={vi.fn()} onChanged={onChanged} />,
  );
  return onChanged;
}

beforeEach(() => {
  vi.clearAllMocks();
  iam.listIamRoles.mockResolvedValue([
    { name: 'DECANO', description: 'Decano de facultad', portal: 'decano', system: true },
    { name: 'DIRECTOR', description: 'Director de carrera', portal: 'director', system: true },
    { name: 'RECTOR', description: null, portal: 'rector', system: true },
  ]);
  iam.getIamUserRoles.mockResolvedValue({
    direct: [{ name: 'RECTOR', description: null }],
    effective: [{ name: 'RECTOR', description: null }, { name: 'DECANO', description: null }],
  });
  iam.listIamPermissions.mockResolvedValue([
    { name: 'dw:closure:read', description: 'Consultar cierres', resource: 'dw:closure', action: 'read', system: false },
    { name: 'olap:admin', description: 'Administrar Saiku', resource: 'olap', action: 'admin', system: false },
  ]);
  iam.getIamUserPermissions.mockResolvedValue({ direct: [], effective: [{ name: 'analytics:read', description: null }] });
});

describe('UserManagementSheet — account', () => {
  it('asks for confirmation before deactivating and reports the change', async () => {
    iam.setIamUserEnabled.mockResolvedValue({ ...user, enabled: false });
    const onChanged = open();

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Desactivar este usuario?' });
    expect(within(dialog).getByText(/no podrá iniciar sesión/)).toBeTruthy();
    expect(iam.setIamUserEnabled).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ isActive: false }));
    expect(iam.setIamUserEnabled).toHaveBeenCalledWith(user.id, false);
    expect(await screen.findByText('Usuario desactivado. Ya no puede iniciar sesión.')).toBeTruthy();
  });

  it('shows the rule auth-service applied when it rejects the change', async () => {
    iam.setIamUserEnabled.mockRejectedValue(
      new IamRequestError('Es el último SUPERADMIN habilitado: asigna el rol a otra cuenta antes.', 409),
    );
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desactivar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('último SUPERADMIN');
  });

  it('resends the invitation and sends a password reset', async () => {
    iam.sendIamActionsEmail.mockResolvedValue(undefined);
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Reenviar invitación' }));
    await waitFor(() => expect(iam.sendIamActionsEmail).toHaveBeenCalledWith(user.id, ['VERIFY_EMAIL', 'UPDATE_PASSWORD']));
    expect(await screen.findByText('Invitación reenviada por correo.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    await waitFor(() => expect(iam.sendIamActionsEmail).toHaveBeenLastCalledWith(user.id, ['UPDATE_PASSWORD']));
  });

  it('cannot e-mail a user without an address', () => {
    open('account', true, { ...user, email: '' });
    expect(screen.getByRole('button', { name: 'Reenviar invitación' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/no tiene correo/)).toBeTruthy();
  });

  it('activates an inactive user', async () => {
    iam.setIamUserEnabled.mockResolvedValue({ ...user, enabled: true });
    open('account', true, { ...user, isActive: false });
    fireEvent.click(screen.getByRole('button', { name: 'Activar usuario' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: '¿Activar este usuario?' }))
      .getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(iam.setIamUserEnabled).toHaveBeenCalledWith(user.id, true));
  });
});

describe('UserManagementSheet — roles and permissions', () => {
  it('edits direct roles and shows the effective ones', async () => {
    iam.replaceIamUserRoles.mockResolvedValue({
      direct: [{ name: 'DIRECTOR', description: null }, { name: 'RECTOR', description: null }],
      effective: [{ name: 'DIRECTOR', description: null }, { name: 'RECTOR', description: null }],
    });
    const onChanged = open('roles');

    const rector = await screen.findByRole('checkbox', { name: 'RECTOR' });
    expect(rector.getAttribute('aria-checked')).toBe('true');
    const effective = screen.getByRole('region', { name: 'Roles efectivos' });
    expect(within(effective).getByText('DECANO')).toBeTruthy();
    expect(within(effective).getByText('(heredado)')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Guardar roles' });
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: 'DIRECTOR' }));
    fireEvent.click(save);

    await waitFor(() => expect(iam.replaceIamUserRoles).toHaveBeenCalledWith(user.id, ['DIRECTOR', 'RECTOR']));
    expect(onChanged).toHaveBeenCalledWith({ roles: ['DIRECTOR', 'RECTOR'] });
    expect(await screen.findByText(/Roles actualizados/)).toBeTruthy();
  });

  it('edits loose permissions', async () => {
    iam.replaceIamUserPermissions.mockResolvedValue({
      direct: [{ name: 'dw:closure:read', description: null }],
      effective: [{ name: 'dw:closure:read', description: null }, { name: 'analytics:read', description: null }],
    });
    open('permissions');

    fireEvent.click(await screen.findByRole('checkbox', { name: 'dw:closure:read' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos' }));

    await waitFor(() => expect(iam.replaceIamUserPermissions).toHaveBeenCalledWith(user.id, ['dw:closure:read']));
  });

  it('is read-only without iam:users:write', async () => {
    open('roles', false);

    expect((await screen.findByRole('checkbox', { name: 'DIRECTOR' })).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Guardar roles' })).toBeNull();
    expect(screen.getByText(/Vista de solo lectura/)).toBeTruthy();
  });

  it('shows a load error with a retry', async () => {
    iam.listIamRoles.mockRejectedValueOnce(new IamRequestError('No se pudo cargar el catálogo de roles (503).', 503));
    open('roles');

    expect((await screen.findByRole('alert')).textContent).toContain('catálogo de roles');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('checkbox', { name: 'DECANO' })).toBeTruthy();
  });
});
