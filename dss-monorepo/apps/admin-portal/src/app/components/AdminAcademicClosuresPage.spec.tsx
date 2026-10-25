import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  closeAcademicPeriod,
  createAcademicClosure,
  getAcademicClosure,
  getDwClosureCapabilities,
  listAcademicClosureEvents,
  listAcademicClosures,
  reopenAcademicPeriod,
} = vi.hoisted(() => ({
  closeAcademicPeriod: vi.fn(),
  createAcademicClosure: vi.fn(),
  getAcademicClosure: vi.fn(),
  getDwClosureCapabilities: vi.fn(),
  listAcademicClosureEvents: vi.fn(),
  listAcademicClosures: vi.fn(),
  reopenAcademicPeriod: vi.fn(),
}));

vi.mock('../data-access/dw-control', () => ({
  closeAcademicPeriod,
  createAcademicClosure,
  getAcademicClosure,
  getDwClosureCapabilities,
  listAcademicClosureEvents,
  listAcademicClosures,
  reopenAcademicPeriod,
}));

import { AdminAcademicClosuresPage } from './AdminAcademicClosuresPage';
import type {
  AcademicClosure,
  AcademicClosureEvent,
  Page,
} from '../data-access/dw-control';

const pending: AcademicClosure = {
  closureId: 12,
  gestion: 2026,
  periodo: 2,
  status: 'PENDIENTE',
  effectiveAt: null,
  authorizedBySubject: null,
  createdBySubject: 'rector-1',
  closureReason: 'Cierre semestral',
  version: 1,
  processedRunId: null,
  processedAt: null,
  createdAt: '2026-10-20T14:00:00Z',
  updatedAt: '2026-10-20T14:00:00Z',
};

const event: AcademicClosureEvent = {
  eventId: 90,
  closureId: 12,
  fromStatus: null,
  toStatus: 'PENDIENTE',
  actorSubject: 'rector-1',
  reason: 'Cierre semestral',
  runId: null,
  occurredAt: '2026-10-20T14:00:00Z',
};

function closurePage(
  items: AcademicClosure[] = [pending],
): Page<AcademicClosure> {
  return {
    items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDwClosureCapabilities.mockResolvedValue({
    canReadClosures: true,
    canManageClosures: true,
    canReadEtlExecutions: false,
  });
  listAcademicClosures.mockResolvedValue(closurePage());
  getAcademicClosure.mockResolvedValue(pending);
  listAcademicClosureEvents.mockResolvedValue({
    items: [event],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  createAcademicClosure.mockResolvedValue(pending);
  closeAcademicPeriod.mockResolvedValue({ ...pending, status: 'CERRADO' });
  reopenAcademicPeriod.mockResolvedValue({ ...pending, status: 'REABIERTO' });
});

describe('AdminAcademicClosuresPage', () => {
  it('lists closures with filters, pagination and permission-aware actions', async () => {
    listAcademicClosures.mockResolvedValue({
      ...closurePage(),
      totalElements: 37,
      totalPages: 2,
    });
    render(<AdminAcademicClosuresPage />);

    expect(await screen.findByText('2026 · Periodo 2')).toBeTruthy();
    expect(screen.getAllByText('PENDIENTE').length).toBeGreaterThan(0);
    expect(screen.getByText('Mostrando 1–20 de 37')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Autorizar cierre 2026 periodo 2' }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Gestión'), {
      target: { value: '2025' },
    });
    fireEvent.change(screen.getByLabelText('Periodo'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Estado'), {
      target: { value: 'PENDIENTE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(listAcademicClosures).toHaveBeenLastCalledWith(
        { gestion: 2025, periodo: 1, status: 'PENDIENTE', page: 0, size: 20 },
        expect.any(AbortSignal),
      ),
    );
  });

  it('creates a period cut with reason and refreshes the filtered list', async () => {
    render(<AdminAcademicClosuresPage />);
    await screen.findByText('2026 · Periodo 2');
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear corte' })[0]);
    fireEvent.change(screen.getByLabelText('Gestión *'), {
      target: { value: '2027' },
    });
    fireEvent.change(screen.getByLabelText('Periodo *'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de creación *'), {
      target: { value: 'Inicio del periodo académico' },
    });
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Crear corte',
      }),
    );

    await waitFor(() =>
      expect(createAcademicClosure).toHaveBeenCalledWith({
        gestion: 2027,
        periodo: 1,
        reason: 'Inicio del periodo académico',
      }),
    );
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('shows actor, reason and the audited event in closure details', async () => {
    render(<AdminAcademicClosuresPage />);
    await screen.findByText('2026 · Periodo 2');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver detalle del corte 2026 periodo 2',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Detalle del cierre')).toBeTruthy();
    expect(
      await within(dialog).findByText('Historial de auditoría'),
    ).toBeTruthy();
    expect(within(dialog).getAllByText('Cierre semestral').length).toBe(2);
    expect(within(dialog).getByText('Actor: rector-1')).toBeTruthy();
    expect(getAcademicClosure).toHaveBeenCalledWith(12);
    expect(listAcademicClosureEvents).toHaveBeenCalledWith(12, 0);
  });

  it('authorizes a pending cut with effective date and reason', async () => {
    render(<AdminAcademicClosuresPage />);
    await screen.findByText('2026 · Periodo 2');
    fireEvent.click(
      screen.getByRole('button', { name: 'Autorizar cierre 2026 periodo 2' }),
    );
    fireEvent.change(screen.getByLabelText('Fecha efectiva *'), {
      target: { value: '2026-10-25T08:30' },
    });
    fireEvent.change(screen.getByLabelText('Motivo *'), {
      target: { value: 'Acta aprobada por la autoridad' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));

    await waitFor(() =>
      expect(closeAcademicPeriod).toHaveBeenCalledWith(12, {
        effectiveAt: new Date('2026-10-25T08:30').toISOString(),
        reason: 'Acta aprobada por la autoridad',
      }),
    );
  });

  it('reopens a closed cut and records the required reason', async () => {
    const closed = { ...pending, status: 'CERRADO' as const };
    listAcademicClosures.mockResolvedValue(closurePage([closed]));
    render(<AdminAcademicClosuresPage />);
    await screen.findByText('2026 · Periodo 2');
    fireEvent.click(
      screen.getByRole('button', { name: 'Reabrir corte 2026 periodo 2' }),
    );
    fireEvent.change(screen.getByLabelText('Motivo *'), {
      target: { value: 'Corrección aprobada por la autoridad' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar reapertura' }),
    );

    await waitFor(() =>
      expect(reopenAcademicPeriod).toHaveBeenCalledWith(12, {
        reason: 'Corrección aprobada por la autoridad',
      }),
    );
  });

  it('shows an informative empty state when there are no cuts', async () => {
    listAcademicClosures.mockResolvedValue(closurePage([]));
    render(<AdminAcademicClosuresPage />);

    expect(
      await screen.findByText('Aún no hay cortes académicos'),
    ).toBeTruthy();
    expect(screen.getByText('0 registros')).toBeTruthy();
  });

  it('offers retry after a list error', async () => {
    listAcademicClosures
      .mockRejectedValueOnce(new Error('DW control service unavailable'))
      .mockResolvedValueOnce(closurePage());
    render(<AdminAcademicClosuresPage />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('2026 · Periodo 2')).toBeTruthy();
  });

  it('does not show management actions to read-only users or for processed cuts', async () => {
    getDwClosureCapabilities.mockResolvedValue({
      canReadClosures: true,
      canManageClosures: false,
      canReadEtlExecutions: false,
    });
    const processed = { ...pending, status: 'PROCESADO' as const };
    listAcademicClosures.mockResolvedValue(closurePage([processed]));
    render(<AdminAcademicClosuresPage />);

    const row = await screen.findByRole('row', { name: /2026 · Periodo 2/ });
    expect(within(row).getByText('Informativo')).toBeTruthy();
    expect(
      within(row).queryByRole('button', {
        name: /Autorizar cierre|Reabrir corte/,
      }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear corte' })).toBeNull();
  });

  it('renders a permission-denied state when the account cannot read closures', async () => {
    getDwClosureCapabilities.mockResolvedValue({
      canReadClosures: false,
      canManageClosures: false,
      canReadEtlExecutions: false,
    });
    render(<AdminAcademicClosuresPage />);

    expect(
      await screen.findByText(
        'No tienes permiso para consultar cierres académicos.',
      ),
    ).toBeTruthy();
    expect(listAcademicClosures).not.toHaveBeenCalled();
  });
});
