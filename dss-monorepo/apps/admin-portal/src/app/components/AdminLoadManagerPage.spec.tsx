import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getLoadManagerCapabilities: vi.fn(),
  getLoadManagerHealth: vi.fn(),
  getEtlStatus: vi.fn(),
  listEtlProcesses: vi.fn(),
  listEtlLaunches: vi.fn(),
  listEtlSchedules: vi.fn(),
  launchEtlProcess: vi.fn(),
  stopEtlLaunch: vi.fn(),
}));
const { listAcademicClosures, listEtlExecutions, push } = vi.hoisted(() => ({
  listAcademicClosures: vi.fn(),
  listEtlExecutions: vi.fn(),
  push: vi.fn(),
}));

vi.mock('../data-access/load-manager', () => api);
vi.mock('../data-access/dw-control', () => ({ listAcademicClosures, listEtlExecutions }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AdminLoadManagerPage } from './AdminLoadManagerPage';

const processes = [
  {
    code: 'VERTICAL_LOAD',
    displayName: 'Carga vertical del DW',
    description: 'Carga un periodo cerrado.',
    workflowFile: 'workflows/wf_vertical_uatf_datos_smoke.hwf',
    parameterNames: ['P_RUN_ID'],
    schedulable: true,
    scheduleMode: 'AUTO_PENDING_CLOSURES',
    enabled: true,
  },
  {
    code: 'CATALOG_SYNC',
    displayName: 'Sincronización del catálogo académico',
    description: 'Sincroniza facultades y programas.',
    workflowFile: 'workflows/wf_sync_academic_catalog.hwf',
    parameterNames: [],
    schedulable: true,
    scheduleMode: 'NO_PARAMETERS',
    enabled: true,
  },
];

const launch = {
  id: '11111111-1111-4111-8111-111111111111',
  processCode: 'CATALOG_SYNC',
  trigger: 'MANUAL',
  scheduleId: null,
  closureId: null,
  runId: null,
  parameters: {},
  status: 'SUBMITTED',
  active: true,
  hopExecutionId: null,
  requestedBy: 'admin',
  requestedAt: '2026-11-23T06:00:00Z',
  submittedAt: '2026-11-23T06:00:01Z',
  startedAt: null,
  finishedAt: null,
  stopRequestedBy: null,
  stopRequestedAt: null,
  resultSummary: null,
  rowVersion: 2,
};

function capabilities(execute: boolean) {
  api.getLoadManagerCapabilities.mockResolvedValue({
    canReadEtlExecutions: true,
    canExecuteEtl: execute,
    canManageEtlSchedules: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getLoadManagerHealth.mockResolvedValue({
    hopOnline: true,
    hopStatus: 'Online',
    monitoringEnabled: true,
    schedulerEnabled: true,
    operatingWindow: 'lunes a viernes 08:00–18:00 (America/La_Paz)',
    checkedAt: '2026-11-23T06:00:00Z',
  });
  api.getEtlStatus.mockResolvedValue({ running: false, active: [] });
  api.listEtlProcesses.mockResolvedValue(processes);
  api.listEtlLaunches.mockResolvedValue({ items: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
  api.listEtlSchedules.mockResolvedValue([]);
  listAcademicClosures.mockResolvedValue({
    items: [{ closureId: 7, gestion: 2026, periodo: 2, status: 'CERRADO' }],
    page: 0,
    size: 50,
    totalElements: 1,
    totalPages: 1,
  });
});

describe('AdminLoadManagerPage', () => {
  it('launches a process and opens its detail', async () => {
    capabilities(true);
    api.launchEtlProcess.mockResolvedValue(launch);
    render(<AdminLoadManagerPage />);

    expect(await screen.findByText('En línea')).toBeTruthy();
    const card = (await screen.findByText('Sincronización del catálogo académico')).closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Ejecutar/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Ejecutar/ }));

    await waitFor(() => expect(api.launchEtlProcess).toHaveBeenCalledWith({ processCode: 'CATALOG_SYNC' }));
    expect(push).toHaveBeenCalledWith(`/etl/launches/${launch.id}`);
  });

  it('loads a closed period for the vertical load', async () => {
    capabilities(true);
    api.launchEtlProcess.mockResolvedValue({ ...launch, processCode: 'VERTICAL_LOAD' });
    render(<AdminLoadManagerPage />);

    const card = (await screen.findByText('Carga vertical del DW')).closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Ejecutar/ }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(/Gestión 2026 · periodo 2/);
    fireEvent.click(within(dialog).getByRole('button', { name: /Ejecutar/ }));

    await waitFor(() =>
      expect(api.launchEtlProcess).toHaveBeenCalledWith({
        processCode: 'VERTICAL_LOAD',
        executionKind: 'CIERRE_ACADEMICO',
        closureId: 7,
      }),
    );
  });

  it('reprocesses a finished run picked from a list instead of a typed run ID', async () => {
    capabilities(true);
    const run = (runId: string, closureId: number | null, status: string, requestedAt: string, periodo = 2) => ({
      runId,
      executionKind: 'CIERRE_ACADEMICO',
      status,
      closureId,
      requestedGestion: 2026,
      requestedPeriodo: periodo,
      requestedBy: 'hop',
      requestedAt,
      startedAt: requestedAt,
      endedAt: requestedAt,
    });
    listEtlExecutions.mockResolvedValue({
      items: [
        // Older attempt of the same closure: only the latest one is offered.
        run('aaaaaaaa-0000-4000-8000-000000000000', 7, 'FALLIDA', '2026-11-20T10:00:00Z'),
        run('bbbbbbbb-0000-4000-8000-000000000000', 7, 'FALLIDA', '2026-11-21T10:00:00Z'),
        // Closure 3 is not CERRADO anymore (already processed): shown but not selectable.
        run('cccccccc-0000-4000-8000-000000000000', 3, 'EXITOSA', '2026-11-19T10:00:00Z', 1),
        run('dddddddd-0000-4000-8000-000000000000', 7, 'EN_EJECUCION', '2026-11-22T10:00:00Z'),
      ],
      page: 0,
      size: 100,
      totalElements: 4,
      totalPages: 1,
    });
    api.launchEtlProcess.mockResolvedValue({ ...launch, processCode: 'VERTICAL_LOAD' });
    render(<AdminLoadManagerPage />);

    const card = (await screen.findByText('Carga vertical del DW')).closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Ejecutar/ }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(/Gestión 2026 · periodo 2/);
    fireEvent.change(within(dialog).getByLabelText('Tipo de carga'), { target: { value: 'REPROCESO' } });

    const select = (await within(dialog).findByLabelText(/Ejecución a reprocesar/)) as HTMLSelectElement;
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((option) => option.value)).toEqual([
      'bbbbbbbb-0000-4000-8000-000000000000',
      'cccccccc-0000-4000-8000-000000000000',
    ]);
    expect(options[1].disabled).toBe(true);
    expect(options[1].textContent).toMatch(/cierre ya procesado/);
    expect(select.value).toBe('bbbbbbbb-0000-4000-8000-000000000000');

    fireEvent.click(within(dialog).getByRole('button', { name: /Ejecutar/ }));
    await waitFor(() =>
      expect(api.launchEtlProcess).toHaveBeenCalledWith({
        processCode: 'VERTICAL_LOAD',
        executionKind: 'REPROCESO',
        retryOfRunId: 'bbbbbbbb-0000-4000-8000-000000000000',
      }),
    );
  });

  it('shows the running launches and lets operators stop them', async () => {
    capabilities(true);
    api.getEtlStatus.mockResolvedValue({ running: true, active: [launch] });
    api.stopEtlLaunch.mockResolvedValue({ ...launch, stopRequestedAt: '2026-11-23T06:01:00Z' });
    render(<AdminLoadManagerPage />);

    fireEvent.click(await screen.findByRole('button', { name: /^Detener$/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Detener' }));

    await waitFor(() => expect(api.stopEtlLaunch).toHaveBeenCalledWith(launch.id));
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('is read-only without dw:etl:execute', async () => {
    capabilities(false);
    render(<AdminLoadManagerPage />);

    await screen.findByText('Carga vertical del DW');
    expect(screen.queryByRole('button', { name: /Ejecutar/ })).toBeNull();
    expect(screen.getByText(/se requiere el permiso dw:etl:execute/)).toBeTruthy();
  });
});
