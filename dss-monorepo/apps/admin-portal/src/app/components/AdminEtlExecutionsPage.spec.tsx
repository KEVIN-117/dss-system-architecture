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

/** Las llamadas con size=1 son los conteos de los indicadores. */
function tableCalls() {
  return listEtlExecutions.mock.calls.filter(([filters]) => filters.size === 20);
}

beforeEach(() => {
  vi.clearAllMocks();
  getDwClosureCapabilities.mockResolvedValue({
    canReadClosures: false,
    canManageClosures: false,
    canReadEtlExecutions: true,
  });
  listEtlExecutions.mockImplementation(async (filters: { size: number; page: number }) =>
    filters.size === 1
      ? { items: [], page: 0, size: 1, totalElements: 3, totalPages: 3 }
      : { items: [summary], page: filters.page, size: 20, totalElements: 25, totalPages: 2 },
  );
});

describe('AdminEtlExecutionsPage', () => {
  it('lists executions with readable labels, filters by status tab and pages through results', async () => {
    render(<AdminEtlExecutionsPage />);
    expect(await screen.findByText('248c6e1c…')).toBeTruthy();
    expect(screen.getAllByText('Cierre académico').length).toBeGreaterThan(0);
    expect(screen.getByText('Cierre #12')).toBeTruthy();
    expect(screen.getAllByText('Fallida').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /^Fallidas/ }));
    await waitFor(() =>
      expect(tableCalls().at(-1)?.[0]).toEqual({ page: 0, size: 20, status: 'FALLIDA' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Más filtros/ }));
    fireEvent.change(screen.getByLabelText('Gestión'), { target: { value: '2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() =>
      expect(tableCalls().at(-1)?.[0]).toEqual({
        page: 0,
        size: 20,
        status: 'FALLIDA',
        gestion: 2026,
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Página siguiente' }));
    await waitFor(() =>
      expect(tableCalls().at(-1)?.[0]).toEqual({
        page: 1,
        size: 20,
        status: 'FALLIDA',
        gestion: 2026,
      }),
    );
  });

  it('shows KPI counts from the API and links each row to its detail page', async () => {
    render(<AdminEtlExecutionsPage />);
    const row = await screen.findByRole('row', { name: /248c6e1c/ });
    const link = within(row).getByRole('link', { name: /Ver detalle/ });
    expect(link.getAttribute('href')).toBe(`/etl-executions/${summary.runId}`);
    expect(await screen.findByText('Ejecuciones registradas')).toBeTruthy();
    await waitFor(() =>
      expect(listEtlExecutions.mock.calls.filter(([f]) => f.size === 1)).toHaveLength(7),
    );
  });

  it('blocks access when the role is missing and does not call the executions API', async () => {
    getDwClosureCapabilities.mockResolvedValue({
      canReadClosures: false,
      canManageClosures: false,
      canReadEtlExecutions: false,
    });
    render(<AdminEtlExecutionsPage />);
    expect(
      await screen.findByText('Tu cuenta no tiene permiso para consultar ejecuciones ETL.'),
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
    expect(await screen.findByText('No hay ejecuciones para mostrar')).toBeTruthy();
    const before = tableCalls().length;
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
    await waitFor(() => expect(tableCalls().length).toBe(before + 1));
  });
});
