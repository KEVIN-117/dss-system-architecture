import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getAcademicCatalog: vi.fn(),
  replaceAdminUserContexts: vi.fn(),
}));
vi.mock('../data-access/auth-admin', () => auth);

import type { AdminUserDirectoryEntry } from '../data-access/auth-admin';
import { AcademicContextsPanel } from './AcademicContextsPanel';

const base: AdminUserDirectoryEntry = {
  id: '223e4567-e89b-42d3-a456-426614174000',
  username: 'luis.decano',
  email: 'luis@example.edu',
  firstName: 'Luis',
  lastName: 'Mamani',
  isActive: true,
  roles: ['DECANO'],
  academicScope: 'FACULTY',
  academicContexts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.getAcademicCatalog.mockResolvedValue({
    faculties: [{ id: 4, name: 'Ingeniería' }, { id: 6, name: 'Ciencias Puras' }],
    careers: [{ id: '101', name: 'Sistemas', facultyId: 4 }, { id: '102', name: 'Civil', facultyId: 4 }],
  });
  auth.replaceAdminUserContexts.mockImplementation(async (userId: string, contexts: { facultyId: number; careerId: string | null }[]) =>
    contexts.map((context, index) => ({ id: `c-${index}`, userId, ...context })));
});

/** IAM-009: several academic contexts per user. */
describe('AcademicContextsPanel', () => {
  it('assigns two faculties to an acting dean', async () => {
    const onSaved = vi.fn();
    render(<AcademicContextsPanel user={base} canWrite onSaved={onSaved} />);

    expect(await screen.findByText('Sin contextos asignados.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar facultad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar facultad' }));
    fireEvent.change(screen.getByLabelText('Facultad 1'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Facultad 2'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contextos' }));

    await waitFor(() => expect(auth.replaceAdminUserContexts).toHaveBeenCalledWith(base.id, [
      { facultyId: 4, careerId: null },
      { facultyId: 6, careerId: null },
    ]));
    expect(onSaved).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ facultyId: 6 })]));
    expect(await screen.findByText('Contextos académicos actualizados.')).toBeTruthy();
  });

  it('requires a career per entry for a director and filters careers by faculty', async () => {
    render(<AcademicContextsPanel user={{ ...base, roles: ['DIRECTOR'], academicScope: 'CAREER' }} canWrite onSaved={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar carrera' }));
    fireEvent.change(screen.getByLabelText('Facultad 1'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contextos' }));
    expect((await screen.findByRole('alert')).textContent).toContain('facultad y carrera');
    expect(screen.getByRole('option', { name: 'Civil' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Carrera 1'), { target: { value: '102' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contextos' }));
    await waitFor(() => expect(auth.replaceAdminUserContexts).toHaveBeenCalledWith(base.id, [
      { facultyId: 4, careerId: '102' },
    ]));
  });

  it('rejects empty lists and duplicates before calling the service, and removes entries', async () => {
    render(<AcademicContextsPanel
      user={{ ...base, academicContexts: [{ id: 'a', userId: base.id, facultyId: 4, careerId: null }] }}
      canWrite
      onSaved={vi.fn()}
    />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar facultad' }));
    fireEvent.change(screen.getByLabelText('Facultad 2'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contextos' }));
    expect((await screen.findByRole('alert')).textContent).toContain('repetidos');

    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar Ingeniería' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar Ingeniería' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contextos' }));
    expect((await screen.findByRole('alert')).textContent).toContain('al menos un contexto');
    expect(auth.replaceAdminUserContexts).not.toHaveBeenCalled();
  });

  it('lets a custom role with analytics:faculty receive faculties', async () => {
    render(<AcademicContextsPanel
      user={{ ...base, roles: ['VICEDECANO'], academicScope: 'FACULTY' }}
      canWrite
      onSaved={vi.fn()}
    />);

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar facultad' }));
    fireEvent.change(screen.getByLabelText('Facultad 1'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contextos' }));
    await waitFor(() => expect(auth.replaceAdminUserContexts).toHaveBeenCalledWith(base.id, [
      { facultyId: 6, careerId: null },
    ]));
  });

  it('explains that a global scope takes no context', () => {
    render(<AcademicContextsPanel user={{ ...base, roles: ['RECTOR'], academicScope: 'GLOBAL' }} canWrite onSaved={vi.fn()} />);
    expect(screen.getByText('Este usuario no utiliza contexto académico.')).toBeTruthy();
    expect(screen.getByText(/analytics:global/)).toBeTruthy();
    expect(auth.getAcademicCatalog).not.toHaveBeenCalled();
  });

  it('asks for a role with analytics:faculty or analytics:career when the scope is none', () => {
    render(<AcademicContextsPanel user={{ ...base, roles: ['ANALYST'], academicScope: 'NONE' }} canWrite onSaved={vi.fn()} />);
    expect(screen.getByText(/analytics:faculty ni analytics:career/)).toBeTruthy();
    expect(auth.getAcademicCatalog).not.toHaveBeenCalled();
  });

  it('is read-only without iam:users:write', async () => {
    render(<AcademicContextsPanel
      user={{ ...base, academicContexts: [{ id: 'a', userId: base.id, facultyId: 4, careerId: null }] }}
      canWrite={false}
      onSaved={vi.fn()}
    />);
    expect((await screen.findByLabelText('Facultad 1')).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Guardar contextos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Agregar facultad' })).toBeNull();
  });
});
