import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAcademicCatalog, listAdminUsers, replaceAdminUserContexts } =
  vi.hoisted(() => ({
    getAcademicCatalog: vi.fn(),
    listAdminUsers: vi.fn(),
    replaceAdminUserContexts: vi.fn(),
  }));

vi.mock('../data-access/auth-admin', () => ({
  getAcademicCatalog,
  listAdminUsers,
  replaceAdminUserContexts,
}));

import { AdminUsersPage } from './AdminUsersPage';
import type {
  AcademicCatalog,
  AdminUserDirectoryEntry,
} from '../data-access/auth-admin';

const director: AdminUserDirectoryEntry = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  username: 'ana.directora',
  email: 'ana@example.edu',
  firstName: 'Ana',
  lastName: 'García',
  isActive: true,
  roles: ['DIRECTOR'],
  academicContexts: [
    {
      id: 'context-1',
      userId: '123e4567-e89b-42d3-a456-426614174000',
      facultyId: 4,
      careerId: '101',
    },
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
  listAdminUsers.mockResolvedValue(pageResult());
  getAcademicCatalog.mockResolvedValue(catalog);
  replaceAdminUserContexts.mockResolvedValue([
    {
      id: 'new-context',
      userId: director.id,
      facultyId: 8,
      careerId: '202',
    },
  ]);
});

describe('AdminUsersPage', () => {
  it('loads users, context and actions in a paginated table', async () => {
    listAdminUsers.mockResolvedValue(
      pageResult([director, decano], { totalElements: 27, totalPages: 2 }),
    );
    render(<AdminUsersPage />);

    expect(await screen.findByText('Ana García')).toBeTruthy();
    expect(screen.getByText('ana@example.edu')).toBeTruthy();
    const anaRow = screen.getByRole('row', { name: /Ana García/ });
    expect(within(anaRow).getByText('DIRECTOR')).toBeTruthy();
    expect(within(anaRow).getByText('Facultad 4 · Carrera 101')).toBeTruthy();
    expect(within(anaRow).getByText('Activo')).toBeTruthy();
    const luisRow = screen.getByRole('row', { name: /Luis Mamani/ });
    expect(within(luisRow).getByText('Inactivo')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–20 de 27')).toBeTruthy();
    expect(
      screen.getByRole('navigation', { name: 'Paginación de usuarios' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Página siguiente' }).hasAttribute(
        'disabled',
      ),
    ).toBe(false);
  });

  it('applies search and role filters, then resets to the first page', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Ana García');
    fireEvent.change(screen.getByLabelText('Buscar usuarios'), {
      target: { value: 'luis' },
    });
    fireEvent.change(screen.getByLabelText('Rol'), {
      target: { value: 'DECANO' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(listAdminUsers).toHaveBeenLastCalledWith(
        { q: 'luis', role: 'DECANO', active: undefined, page: 0, size: 20 },
        expect.any(AbortSignal),
      ),
    );
  });

  it('loads catalog names and updates a director context from the side panel', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Ana García');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Asignar contexto académico a ana.directora',
      }),
    );

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Alcance requerido: DIRECTOR')).toBeTruthy();
    expect(await screen.findByRole('option', { name: 'Ingeniería · ID 4' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Facultad *'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByLabelText('Carrera *'), {
      target: { value: '202' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contexto' }));

    await waitFor(() =>
      expect(replaceAdminUserContexts).toHaveBeenCalledWith(director.id, [
        { facultyId: 8, careerId: '202' },
      ]),
    );
    expect(
      await screen.findByText('Contexto académico actualizado.'),
    ).toBeTruthy();
  });

  it('assigns a faculty-only scope to a dean', async () => {
    listAdminUsers.mockResolvedValue(pageResult([decano]));
    render(<AdminUsersPage />);
    await screen.findByText('Luis Mamani');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Asignar contexto académico a luis.decano',
      }),
    );

    expect(await screen.findByText('Alcance requerido: DECANO')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Facultad *'), {
      target: { value: '6' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contexto' }));
    await waitFor(() =>
      expect(replaceAdminUserContexts).toHaveBeenCalledWith(decano.id, [
        { facultyId: 6, careerId: null },
      ]),
    );
  });

  it('shows empty and error states accessibly', async () => {
    listAdminUsers.mockResolvedValueOnce(pageResult([], { totalElements: 0, totalPages: 0 }));
    const { unmount } = render(<AdminUsersPage />);
    expect(
      await screen.findByText('No hay usuarios que coincidan con estos filtros.'),
    ).toBeTruthy();
    unmount();

    listAdminUsers.mockRejectedValueOnce(new Error('Auth Service no disponible'));
    render(<AdminUsersPage />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Auth Service no disponible',
    );
  });
});
