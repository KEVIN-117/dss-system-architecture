import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createIamUser } = vi.hoisted(() => ({ createIamUser: vi.fn() }));
vi.mock('../data-access/iam-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-users')>()),
  createIamUser,
}));

import { IamRequestError } from '../data-access/iam-users';
import { CreateUserDialog } from './CreateUserDialog';

function renderDialog() {
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();
  render(<CreateUserDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);
  return { onCreated, onOpenChange };
}

function fill(username: string, email: string) {
  fireEvent.change(screen.getByLabelText(/^Usuario/), { target: { value: username } });
  fireEvent.change(screen.getByLabelText(/^Correo electrónico/), { target: { value: email } });
}

beforeEach(() => vi.clearAllMocks());

describe('CreateUserDialog', () => {
  it('validates the username and e-mail before calling the service', async () => {
    renderDialog();
    fill('a b', 'ana@uatf.edu.bo');
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    expect((await screen.findByRole('alert')).textContent).toContain('El usuario debe tener');

    fill('ana.perez', 'not-an-email');
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    expect((await screen.findByRole('alert')).textContent).toContain('correo electrónico válido');
    expect(createIamUser).not.toHaveBeenCalled();
  });

  it('creates the user without an invitation when unchecked, then closes', async () => {
    const created = { id: 'x', username: 'ana.perez' };
    createIamUser.mockResolvedValue(created);
    const { onCreated, onOpenChange } = renderDialog();

    fill('ana.perez', 'ana@uatf.edu.bo');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enviar invitación por correo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

    await waitFor(() => expect(createIamUser).toHaveBeenCalledWith({
      username: 'ana.perez', email: 'ana@uatf.edu.bo', firstName: '', lastName: '', sendInvitation: false,
    }));
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the form open and shows why auth-service rejected it', async () => {
    createIamUser.mockRejectedValue(new IamRequestError('Ya existe un usuario con ese nombre o correo.', 409));
    const { onCreated, onOpenChange } = renderDialog();

    fill('ana.perez', 'ana@uatf.edu.bo');
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Ya existe un usuario');
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
