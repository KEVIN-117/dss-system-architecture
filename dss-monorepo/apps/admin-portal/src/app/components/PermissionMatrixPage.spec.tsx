import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const access = vi.hoisted(() => ({
  getPermissionMatrix: vi.fn(),
  replaceRolePermissions: vi.fn(),
}));
const { useHasPermission } = vi.hoisted(() => ({ useHasPermission: vi.fn() }));
vi.mock('../data-access/iam-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-access')>()),
  ...access,
}));
vi.mock('@dss-monorepo/rbac', () => ({ useHasPermission }));

import { IamRequestError } from '../data-access/iam-users';
import { PermissionMatrixPage, pendingChanges } from './PermissionMatrixPage';

const permission = (name: string) => ({
  name,
  description: null,
  resource: name.slice(0, name.lastIndexOf(':')),
  action: name.slice(name.lastIndexOf(':') + 1),
  system: name.startsWith('iam:'),
});

beforeEach(() => {
  vi.clearAllMocks();
  useHasPermission.mockReturnValue(true);
  access.getPermissionMatrix.mockResolvedValue({
    roles: [
      { name: 'SUPERADMIN', description: null, portal: null, system: true },
      { name: 'DECANO', description: null, portal: 'decano', system: true },
      { name: 'DIRECTOR', description: null, portal: 'director', system: true },
    ],
    permissions: ['analytics:read', 'dw:closure:read', 'iam:users:read', 'portal:decano', 'portal:director'].map(permission),
    grants: {
      SUPERADMIN: ['iam:users:read'],
      DECANO: ['analytics:read', 'portal:decano'],
      DIRECTOR: ['analytics:read', 'portal:director'],
    },
  });
  access.replaceRolePermissions.mockImplementation(async (_role: string, names: string[]) => names.map(permission));
});

const cell = (role: string, name: string) => screen.getByRole('checkbox', { name: `${role} · ${name}` }) as HTMLInputElement;

describe('pendingChanges', () => {
  it('lists only roles that gain or lose permissions', () => {
    const original = { A: new Set(['x:read']), B: new Set(['y:read']) };
    const draft = { A: new Set(['x:read', 'z:read']), B: new Set(['y:read']) };
    expect(pendingChanges(original, draft)).toEqual([{ role: 'A', added: ['z:read'], removed: [] }]);
  });
});

describe('PermissionMatrixPage', () => {
  it('renders the grants and locks SUPERADMIN iam permissions', async () => {
    render(<PermissionMatrixPage />);
    await screen.findByRole('table', { name: 'Matriz de roles y permisos' });

    expect(cell('DECANO', 'analytics:read').checked).toBe(true);
    expect(cell('DECANO', 'dw:closure:read').checked).toBe(false);
    expect(cell('SUPERADMIN', 'iam:users:read').disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Revisar cambios (0)' })).toHaveProperty('disabled', true);
  });

  it('shows portal:* rows locked, pointing to the role editor', async () => {
    render(<PermissionMatrixPage />);
    await screen.findByRole('table', { name: 'Matriz de roles y permisos' });

    expect(cell('DECANO', 'portal:decano').checked).toBe(true);
    expect(cell('DECANO', 'portal:decano').disabled).toBe(true);
    expect(cell('DECANO', 'portal:director').checked).toBe(false);
    expect(cell('DECANO', 'portal:director').disabled).toBe(true);
    expect(cell('DECANO', 'portal:director').title).toContain('Roles');
    expect(screen.getByRole('link', { name: 'Roles' }).getAttribute('href')).toBe('/roles');
  });

  it('is read-only without iam:roles:write', async () => {
    useHasPermission.mockReturnValue(false);
    render(<PermissionMatrixPage />);
    await screen.findByRole('table', { name: 'Matriz de roles y permisos' });

    expect(cell('DECANO', 'dw:closure:read').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Revisar cambios/ })).toBeNull();
  });

  it('previews additions and removals and saves each changed role', async () => {
    render(<PermissionMatrixPage />);
    await screen.findByRole('table', { name: 'Matriz de roles y permisos' });
    fireEvent.click(cell('DECANO', 'dw:closure:read'));
    fireEvent.click(cell('DIRECTOR', 'analytics:read'));

    fireEvent.click(screen.getByRole('button', { name: 'Revisar cambios (2)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revisar cambios' });
    const items = within(within(dialog).getByRole('list', { name: 'Cambios pendientes' })).getAllByRole('listitem');
    expect(items[0].textContent).toContain('DECANO');
    expect(items[0].textContent).toContain('Agregadw:closure:read');
    expect(dialog.textContent).toContain('Quitaanalytics:read');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(access.replaceRolePermissions).toHaveBeenCalledTimes(2));
    expect(access.replaceRolePermissions).toHaveBeenNthCalledWith(1, 'DECANO', ['analytics:read', 'portal:decano', 'dw:closure:read']);
    expect(access.replaceRolePermissions).toHaveBeenNthCalledWith(2, 'DIRECTOR', ['portal:director']);
    expect((await screen.findByRole('status')).textContent).toContain('2 roles');
    expect(screen.getByRole('button', { name: 'Revisar cambios (0)' })).toBeTruthy();
  });

  it('keeps the failed role pending and reports why', async () => {
    access.replaceRolePermissions
      .mockRejectedValueOnce(new IamRequestError('Permiso inexistente', 409))
      .mockImplementationOnce(async (_role: string, names: string[]) => names.map(permission));
    render(<PermissionMatrixPage />);
    await screen.findByRole('table', { name: 'Matriz de roles y permisos' });
    fireEvent.click(cell('DECANO', 'dw:closure:read'));
    fireEvent.click(cell('DIRECTOR', 'dw:closure:read'));

    fireEvent.click(screen.getByRole('button', { name: 'Revisar cambios (2)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revisar cambios' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('DECANO: Permiso inexistente');
    expect(screen.getByRole('button', { name: 'Revisar cambios (1)', hidden: true })).toBeTruthy();
  });

  it('discards local edits', async () => {
    render(<PermissionMatrixPage />);
    await screen.findByRole('table', { name: 'Matriz de roles y permisos' });
    fireEvent.click(cell('DECANO', 'dw:closure:read'));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(cell('DECANO', 'dw:closure:read').checked).toBe(false);
    expect(access.replaceRolePermissions).not.toHaveBeenCalled();
  });
});
