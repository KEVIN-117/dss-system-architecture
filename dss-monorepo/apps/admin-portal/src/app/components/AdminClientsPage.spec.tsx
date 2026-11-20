import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  rotateClientSecret: vi.fn(),
}));
const { useHasPermission } = vi.hoisted(() => ({ useHasPermission: vi.fn() }));
vi.mock('../data-access/iam-clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-clients')>()),
  ...api,
}));
vi.mock('@dss-monorepo/rbac', () => ({ useHasPermission }));

import { IamRequestError } from '../data-access/iam-users';
import type { IamClient } from '../data-access/iam-clients';
import { AdminClientsPage } from './AdminClientsPage';

const becas: IamClient = {
  clientId: 'portal-becas',
  name: 'Portal de becas',
  description: null,
  type: 'CONFIDENTIAL',
  enabled: true,
  serviceAccountsEnabled: false,
  redirectUris: ['https://becas.uatf.edu.bo/callback'],
  webOrigins: [],
  postLogoutRedirectUris: [],
  system: false,
};
const bff: IamClient = { ...becas, clientId: 'dss-bff', name: 'BFF', system: true };
const olap: IamClient = { ...becas, clientId: 'olap-service', name: null, system: true };
const spa: IamClient = { ...becas, clientId: 'mi-spa', name: null, type: 'PUBLIC' };

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useHasPermission.mockReturnValue(true);
  api.listClients.mockResolvedValue([olap, becas, bff, spa]);
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('AdminClientsPage', () => {
  it('lists clients sorted and marks protected ones read-only', async () => {
    render(<AdminClientsPage />);
    const table = await screen.findByRole('table', { name: 'Aplicaciones registradas' });
    const rows = within(table).getAllByRole('row').slice(1);

    const ids = rows.map((row) => within(row).getAllByRole('cell')[0].textContent ?? '');
    expect(ids.map((text) => text.match(/^[a-z-]+/)?.[0])).toEqual(['dss-bff', 'mi-spa', 'olap-service', 'portal-becas']);
    expect(rows[0].textContent).toContain('Protegida');
    expect(rows[1].textContent).toContain('Pública');
    expect(rows[3].textContent).not.toContain('Protegida');
    expect(screen.getByRole('button', { name: 'Ver olap-service' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar dss-bff' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rotar secreto de portal-becas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rotar secreto de olap-service' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rotar secreto de mi-spa' })).toBeNull();
  });

  it('opens a protected client read-only', async () => {
    render(<AdminClientsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver olap-service' }));
    const dialog = await screen.findByRole('dialog', { name: 'olap-service' });

    expect(dialog.textContent).toContain('solo lectura');
    expect(within(dialog).getByLabelText('Nombre')).toHaveProperty('disabled', true);
    expect(within(dialog).queryByRole('button', { name: 'Guardar' })).toBeNull();
  });

  it('only lets a reader view clients', async () => {
    useHasPermission.mockReturnValue(false);
    render(<AdminClientsPage />);
    await screen.findByText('portal-becas');

    expect(useHasPermission).toHaveBeenCalledWith('iam:clients:write');
    expect(screen.queryByRole('button', { name: 'Nueva aplicación' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver portal-becas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rotar secreto/ })).toBeNull();
  });

  it('searches by client id', async () => {
    render(<AdminClientsPage />);
    await screen.findByText('portal-becas');
    fireEvent.change(screen.getByLabelText('Buscar por identificador'), { target: { value: ' becas ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(api.listClients).toHaveBeenLastCalledWith('becas', expect.anything()));
  });

  it('registers a confidential client and shows its secret once', async () => {
    api.createClient.mockResolvedValue({ client: { ...becas, clientId: 'portal-tesis' }, secret: 's3cr3t-value' });
    render(<AdminClientsPage />);
    await screen.findByText('portal-becas');

    fireEvent.click(screen.getByRole('button', { name: 'Nueva aplicación' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva aplicación' });
    fireEvent.change(within(dialog).getByLabelText(/Identificador/), { target: { value: 'X' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar aplicación' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('minúsculas');

    fireEvent.change(within(dialog).getByLabelText(/Identificador/), { target: { value: 'Portal-Tesis' } });
    fireEvent.change(within(dialog).getByLabelText('URIs de redirección'), {
      target: { value: 'https://tesis.uatf.edu.bo/cb\n\nhttps://tesis.uatf.edu.bo/cb\n' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar aplicación' }));

    await waitFor(() => expect(api.createClient).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'portal-tesis',
      type: 'CONFIDENTIAL',
      redirectUris: ['https://tesis.uatf.edu.bo/cb'],
      serviceAccountsEnabled: false,
    })));
    const secret = await screen.findByRole('dialog', { name: 'Secreto de portal-tesis' });
    expect((within(secret).getByLabelText('Secreto') as HTMLInputElement).value).toBe('s3cr3t-value');

    fireEvent.click(within(secret).getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('s3cr3t-value'));
    expect(await within(secret).findByRole('button', { name: 'Copiado' })).toBeTruthy();

    fireEvent.click(within(secret).getByRole('button', { name: 'Ya lo guardé' }));
    await waitFor(() => expect(screen.queryByDisplayValue('s3cr3t-value')).toBeNull());
  });

  it('requires a redirect URI for a public client', async () => {
    render(<AdminClientsPage />);
    await screen.findByText('portal-becas');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva aplicación' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva aplicación' });
    fireEvent.change(within(dialog).getByLabelText(/Identificador/), { target: { value: 'mi-app' } });
    fireEvent.change(within(dialog).getByLabelText('Tipo'), { target: { value: 'PUBLIC' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar aplicación' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('al menos una URI');
    expect(api.createClient).not.toHaveBeenCalled();
  });

  it('edits dss-bff without sending enabled', async () => {
    api.updateClient.mockResolvedValue(bff);
    render(<AdminClientsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar dss-bff' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar dss-bff' });

    expect(within(dialog).queryByText('Aplicación activa')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'BFF del DSS' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.updateClient).toHaveBeenCalledWith('dss-bff', {
      name: 'BFF del DSS',
      description: '',
      redirectUris: ['https://becas.uatf.edu.bo/callback'],
      webOrigins: [],
      postLogoutRedirectUris: [],
    }));
  });

  it('rotates a secret after confirmation and reports failures', async () => {
    api.rotateClientSecret
      .mockRejectedValueOnce(new IamRequestError('Keycloak no responde', 503))
      .mockResolvedValueOnce({ clientId: 'portal-becas', secret: 'nuevo-secreto' });
    render(<AdminClientsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rotar secreto de portal-becas' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Rotar el secreto de portal-becas?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Rotar secreto' }));
    expect((await within(confirm).findByRole('alert')).textContent).toContain('Keycloak no responde');

    fireEvent.click(within(confirm).getByRole('button', { name: 'Rotar secreto' }));
    const secret = await screen.findByRole('dialog', { name: 'Secreto de portal-becas' });
    expect((within(secret).getByLabelText('Secreto') as HTMLInputElement).value).toBe('nuevo-secreto');
    expect(screen.getByText(/El anterior ya no es válido/)).toBeTruthy();
  });
});
