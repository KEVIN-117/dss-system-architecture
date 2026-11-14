import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDwClosureCapabilities, getEtlExecution } = vi.hoisted(() => ({
  getDwClosureCapabilities: vi.fn(),
  getEtlExecution: vi.fn(),
}));

vi.mock('../data-access/dw-control', () => ({
  getDwClosureCapabilities,
  getEtlExecution,
}));

import { AdminEtlExecutionDetailPage } from './AdminEtlExecutionDetailPage';

const runId = '248c6e1c-ff2e-45ab-9ddc-dcf501220b9a';

const detail = {
  runId,
  executionKind: 'CIERRE_ACADEMICO' as const,
  status: 'FALLIDA' as const,
  closureId: 12,
  requestedGestion: 2026,
  requestedPeriodo: 2,
  requestedBy: 'rector-1',
  requestedAt: '2026-10-25T10:00:00Z',
  startedAt: '2026-10-25T10:01:00Z',
  endedAt: '2026-10-25T10:03:00Z',
  steps: [
    {
      stepCode: 'source_alumnos',
      phase: 'EXTRACCION' as const,
      status: 'EXITOSO' as const,
      stepOrder: 1,
      startedAt: '2026-10-25T10:01:00Z',
      endedAt: '2026-10-25T10:02:00Z',
    },
    {
      stepCode: 'VALIDAR_CARGA',
      phase: 'VALIDACION' as const,
      status: 'FALLIDO' as const,
      stepOrder: 2,
      startedAt: '2026-10-25T10:02:00Z',
      endedAt: '2026-10-25T10:03:00Z',
    },
  ],
  metrics: [
    { name: 'source_rows_observed', value: 1200, unit: 'ROWS', measuredAt: '2026-10-25T10:01:30Z', source: 'academico.alumnos', stepCode: 'source_alumnos' },
    { name: 'source_rows_observed', value: 300, unit: 'ROWS', measuredAt: '2026-10-25T10:01:40Z' },
    { name: 'Filas procesadas', value: 842, unit: 'filas', measuredAt: '2026-10-25T10:03:00Z' },
  ],
  errors: [
    {
      severity: 'ERROR' as const,
      code: 'DATA_QUALITY',
      message: 'La validación académica encontró inconsistencias.',
      stepCode: 'VALIDAR_CARGA',
      occurredAt: '2026-10-25T10:03:00Z',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getDwClosureCapabilities.mockResolvedValue({
    canReadClosures: false,
    canManageClosures: false,
    canReadEtlExecutions: true,
  });
  getEtlExecution.mockResolvedValue(detail);
});

describe('AdminEtlExecutionDetailPage', () => {
  it('shows status, steps, grouped metrics and sanitized errors read-only', async () => {
    render(<AdminEtlExecutionDetailPage runId={runId} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cierre académico 2026 · P2' }),
    ).toBeTruthy();
    expect(getEtlExecution).toHaveBeenCalledWith(runId);

    const steps = screen.getByRole('region', { name: 'Pasos y línea de tiempo' });
    expect(within(steps).getByText('Validar carga')).toBeTruthy();
    expect(within(steps).getByText('Fallido')).toBeTruthy();

    const metrics = screen.getByRole('region', { name: 'Métricas de volumen' });
    expect(within(metrics).getByText('Filas observadas en origen')).toBeTruthy();
    expect(within(metrics).getByText('2 mediciones', { exact: false })).toBeTruthy();
    expect(within(metrics).getByText('842')).toBeTruthy();
    expect(within(metrics).getByText('Alumnos')).toBeTruthy();
    expect(within(metrics).getByText('academico.alumnos')).toBeTruthy();

    const incidents = screen.getByRole('region', { name: 'Incidencias' });
    expect(
      within(incidents).getByText('La validación académica encontró inconsistencias.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /iniciar|reintentar|retry/i })).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Avance de pasos' }).getAttribute('aria-valuenow')).toBe('50');
  });

  it('blocks access without the role and does not load the execution', async () => {
    getDwClosureCapabilities.mockResolvedValue({
      canReadClosures: false,
      canManageClosures: false,
      canReadEtlExecutions: false,
    });
    render(<AdminEtlExecutionDetailPage runId={runId} />);
    expect(
      await screen.findByText('Tu cuenta no tiene permiso para consultar ejecuciones ETL.'),
    ).toBeTruthy();
    expect(getEtlExecution).not.toHaveBeenCalled();
  });

  it('reports a load error with a retry action', async () => {
    getEtlExecution.mockRejectedValue(new Error('Ejecución no encontrada.'));
    render(<AdminEtlExecutionDetailPage runId={runId} />);
    expect(await screen.findByText('Ejecución no encontrada.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});
