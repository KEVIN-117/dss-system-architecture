import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ listAudit: vi.fn() }));
vi.mock('../data-access/iam-audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-access/iam-audit')>()),
  ...api,
}));

import { auditDiff, auditQuery, type AuditEntry } from '../data-access/iam-audit';
import { AdminAuditPage } from './AdminAuditPage';

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: '0b6f8c1e-1a2b-4c3d-8e9f-001122334455',
  occurredAt: '2026-11-20T14:30:00Z',
  actor: { keycloakId: 'kc-1', username: 'ana.admin', ipAddress: '10.0.0.5' },
  action: 'ROLE_UPDATED',
  targetType: 'ROLE',
  targetId: 'AUDITOR',
  before: { description: 'Auditor', portal: null },
  after: { description: 'Auditor externo', portal: null },
  outcome: 'SUCCESS',
  failureReason: null,
  completedAt: '2026-11-20T14:30:01Z',
  ...overrides,
});

const page = (content: AuditEntry[], totalElements = content.length, number = 0) => ({
  content, page: number, size: 20, totalElements, totalPages: Math.ceil(totalElements / 20),
});

beforeEach(() => {
  vi.clearAllMocks();
  api.listAudit.mockResolvedValue(page([
    entry(),
    entry({
      id: '0b6f8c1e-1a2b-4c3d-8e9f-001122334456',
      action: 'CLIENT_SECRET_ROTATED',
      targetType: 'CLIENT',
      targetId: 'portal-becas',
      before: null,
      after: { secret: '[REDACTED]' },
      outcome: 'FAILURE',
      failureReason: 'Keycloak no respondió',
      actor: { username: null, keycloakId: null },
    }),
  ], 45));
});

describe('auditQuery', () => {
  it('sends only filled filters and makes the end day inclusive', () => {
    const params = auditQuery({ actor: ' ana ', action: '', targetType: 'ROLE', outcome: '', from: '2026-11-01', to: '2026-11-20' }, 2, 20);

    expect(params.get('actor')).toBe('ana');
    expect(params.has('action')).toBe(false);
    expect(params.get('targetType')).toBe('ROLE');
    expect(params.get('page')).toBe('2');
    expect(new Date(params.get('from') as string).getDate()).toBe(1);
    expect(new Date(params.get('to') as string).getDate()).toBe(21);
  });
});

describe('auditDiff', () => {
  it('merges keys and flags the changed ones', () => {
    expect(auditDiff({ a: 1, b: [1] }, { b: [1], c: 'x' })).toEqual([
      { key: 'a', before: 1, after: undefined, changed: true },
      { key: 'b', before: [1], after: [1], changed: false },
      { key: 'c', before: undefined, after: 'x', changed: true },
    ]);
  });
});

describe('AdminAuditPage', () => {
  it('lists entries with readable labels and pages through results', async () => {
    render(<AdminAuditPage />);
    const table = await screen.findByRole('table', { name: 'Registros de auditoría' });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows[0].textContent).toContain('ana.admin');
    expect(rows[0].textContent).toContain('Rol actualizado');
    expect(rows[0].textContent).toContain('Correcto');
    expect(rows[1].textContent).toContain('Sistema');
    expect(rows[1].textContent).toContain('Fallido');
    expect(screen.getByText('Mostrando 1–20 de 45')).toBeTruthy();
    expect(api.listAudit).toHaveBeenCalledWith(expect.objectContaining({ action: '' }), 0, 20, expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(api.listAudit).toHaveBeenLastCalledWith(expect.anything(), 1, 20, expect.anything()));
  });

  it('applies filters from the first page and clears them', async () => {
    render(<AdminAuditPage />);
    await screen.findByText('ana.admin');
    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'CLIENT_SECRET_ROTATED' } });
    fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'FAILURE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    await waitFor(() => expect(api.listAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'CLIENT_SECRET_ROTATED', outcome: 'FAILURE' }), 0, 20, expect.anything(),
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => expect(api.listAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: '', outcome: '' }), 0, 20, expect.anything(),
    ));
  });

  it('rejects an inverted date range', async () => {
    render(<AdminAuditPage />);
    await screen.findByText('ana.admin');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-01' } });

    expect(screen.getByRole('alert').textContent).toContain('no puede ser posterior');
    expect(screen.getByRole('button', { name: 'Filtrar' })).toHaveProperty('disabled', true);
  });

  it('shows before and after in the detail, highlighting changes', async () => {
    render(<AdminAuditPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle: Rol actualizado AUDITOR' }));
    const sheet = await screen.findByRole('dialog', { name: 'Detalle de auditoría' });
    const rows = within(within(sheet).getByRole('table', { name: 'Cambios registrados' })).getAllByRole('row').slice(1);

    expect(rows[0].textContent).toContain('description');
    expect(rows[0].textContent).toContain('(cambió)');
    expect(rows[0].textContent).toContain('Auditor externo');
    expect(rows[1].textContent).not.toContain('(cambió)');
    expect(sheet.textContent).toContain('10.0.0.5');
  });

  it('shows the failure reason and redacted values', async () => {
    render(<AdminAuditPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle: Secreto rotado portal-becas' }));
    const sheet = await screen.findByRole('dialog', { name: 'Detalle de auditoría' });

    expect(sheet.textContent).toContain('Keycloak no respondió');
    expect(sheet.textContent).toContain('[REDACTED]');
  });

  it('offers a retry when the service fails', async () => {
    api.listAudit.mockRejectedValueOnce(new Error('Auditoría no disponible'));
    render(<AdminAuditPage />);

    expect((await screen.findByRole('alert')).textContent).toContain('Auditoría no disponible');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('ana.admin')).toBeTruthy();
  });
});
