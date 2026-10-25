import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDwClosureCapabilities, getEtlExecution, listEtlExecutions } =
  vi.hoisted(() => ({
    getDwClosureCapabilities: vi.fn(),
    getEtlExecution: vi.fn(),
    listEtlExecutions: vi.fn(),
  }));

vi.mock('../data-access/dw-control', () => ({
  getDwClosureCapabilities,
  getEtlExecution,
  listEtlExecutions,
}));

import { AdminEtlExecutionsPage } from './AdminEtlExecutionsPage';

const summary = {
  runId: '248c6e1c-ff2e-45ab-9ddc-dcf501220b9a',
  executionKind: 'CIERRE_ACADEMICO' as const,
  status: 'FALLIDA' as const,
  closureId: 12,
  requestedGestion: 2026,
  requestedPeriodo: 2,
  requestedBy: 'rector-1',
  requestedAt: '2026-10-25T10:00:00Z',
  startedAt: '2026-10-25T10:01:00Z',
  endedAt: '2026-10-25T10:03:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  getDwClosureCapabilities.mockResolvedValue({
    canReadClosures: false,
    canManageClosures: false,
    canReadEtlExecutions: true,
  });
  listEtlExecutions.mockResolvedValue({
    items: [summary],
    page: 0,
    size: 20,
    totalElements: 25,
    totalPages: 2,
  });
  getEtlExecution.mockResolvedValue({
    ...summary,
    steps: [
      {
        stepCode: 'VALIDAR_CARGA',
        phase: 'VALIDACION',
        status: 'FALLIDO',
        stepOrder: 1,
        startedAt: '2026-10-25T10:02:00Z',
        endedAt: '2026-10-25T10:03:00Z',
      },
    ],
    metrics: [
      {
        name: 'Filas procesadas',
        value: 842,
        unit: 'filas',
        measuredAt: '2026-10-25T10:03:00Z',
      },
    ],
    errors: [
      {
        severity: 'ERROR',
        code: 'DATA_QUALITY',
        message: 'La validación académica encontró inconsistencias.',
        stepCode: 'VALIDAR_CARGA',
        occurredAt: '2026-10-25T10:03:00Z',
      },
    ],
  });
});

describe('AdminEtlExecutionsPage', () => {
  it('lists executions, applies filters and pages through results', async () => {
    render(<AdminEtlExecutionsPage />);
    expect(await screen.findByText('248c6e1c…')).toBeTruthy();
    expect(screen.getByText('Cierre #12')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Filtrar por estado'), {
      target: { value: 'FALLIDA' },
    });
    fireEvent.change(screen.getByLabelText('Filtrar por gestión'), {
      target: { value: '2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() =>
      expect(listEtlExecutions).toHaveBeenLastCalledWith(
        { page: 0, size: 20, status: 'FALLIDA', gestion: 2026 },
        expect.any(AbortSignal),
      ),
    );

    listEtlExecutions.mockResolvedValueOnce({
      items: [summary],
      page: 1,
      size: 20,
      totalElements: 25,
      totalPages: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() =>
      expect(listEtlExecutions).toHaveBeenLastCalledWith(
        { page: 1, size: 20, status: 'FALLIDA', gestion: 2026 },
        expect.any(AbortSignal),
      ),
    );
  });

  it('shows execution detail, steps, metrics and sanitized errors read-only', async () => {
    render(<AdminEtlExecutionsPage />);
    const row = await screen.findByRole('row', { name: /248c6e1c/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Ver detalle' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('VALIDAR CARGA')).toBeTruthy();
    expect(within(dialog).getByText('842 filas')).toBeTruthy();
    expect(
      within(dialog).getByText(
        'La validación académica encontró inconsistencias.',
      ),
    ).toBeTruthy();
    expect(
      within(dialog).queryByRole('button', {
        name: /iniciar|reintentar|retry/i,
      }),
    ).toBeNull();
    expect(getEtlExecution).toHaveBeenCalledWith(summary.runId);
  });

  it('blocks access when the role is missing and does not call the executions API', async () => {
    getDwClosureCapabilities.mockResolvedValue({
      canReadClosures: false,
      canManageClosures: false,
      canReadEtlExecutions: false,
    });
    render(<AdminEtlExecutionsPage />);
    expect(
      await screen.findByText(
        'Tu cuenta no tiene permiso para consultar ejecuciones ETL.',
      ),
    ).toBeTruthy();
    expect(listEtlExecutions).not.toHaveBeenCalled();
  });

  it('uses manual refresh and reports an empty result', async () => {
    listEtlExecutions.mockResolvedValue({
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
    render(<AdminEtlExecutionsPage />);
    expect(
      await screen.findByText('No hay ejecuciones para mostrar'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
    await waitFor(() => expect(listEtlExecutions).toHaveBeenCalledTimes(2));
  });
});
