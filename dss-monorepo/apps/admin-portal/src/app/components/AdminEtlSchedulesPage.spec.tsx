import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getLoadManagerCapabilities: vi.fn(),
  listEtlSchedules: vi.fn(),
  listEtlProcesses: vi.fn(),
  listEtlLaunches: vi.fn(),
  previewEtlSchedule: vi.fn(),
  createEtlSchedule: vi.fn(),
  updateEtlSchedule: vi.fn(),
  setEtlScheduleEnabled: vi.fn(),
  deleteEtlSchedule: vi.fn(),
}));

vi.mock('../data-access/load-manager', () => api);
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AdminEtlSchedulesPage } from './AdminEtlSchedulesPage';

const schedule = {
  id: 3,
  processCode: 'VERTICAL_LOAD',
  name: 'Carga nocturna',
  cronExpression: '0 0 2 * * *',
  timezone: 'America/La_Paz',
  mode: 'AUTO_PENDING_CLOSURES',
  enabled: true,
  nextFireAt: '2026-11-24T06:00:00Z',
  lastFiredAt: '2026-11-23T06:00:00Z',
  lastLaunchId: '55555555-5555-4555-8555-555555555555',
  firing: false,
  createdBy: 'admin',
  createdAt: '2026-11-01T00:00:00Z',
  updatedBy: 'admin',
  updatedAt: '2026-11-01T00:00:00Z',
  rowVersion: 4,
};

const processes = [
  {
    code: 'VERTICAL_LOAD',
    displayName: 'Carga vertical del DW',
    description: '',
    workflowFile: 'workflows/wf_vertical_uatf_datos_smoke.hwf',
    parameterNames: [],
    schedulable: true,
    scheduleMode: 'AUTO_PENDING_CLOSURES',
    enabled: true,
  },
  {
    code: 'PUBLISH_STAGED',
    displayName: 'Publicación',
    description: '',
    workflowFile: 'workflows/wf_hop_publish_staged_run.hwf',
    parameterNames: ['P_RUN_ID'],
    schedulable: false,
    scheduleMode: null,
    enabled: true,
  },
];

function preview(valid: boolean) {
  return {
    cronExpression: '0 0 10 * * *',
    timezone: 'America/La_Paz',
    operatingWindow: 'lunes a viernes 08:00–18:00 (America/La_Paz)',
    valid,
    validationMessage: valid ? null : 'La ejecución del lunes 23/11/2026 10:00 cae dentro del horario operativo de la DSA',
    occurrences: [{ at: '2026-11-23T14:00:00Z', insideOperatingWindow: !valid }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getLoadManagerCapabilities.mockResolvedValue({
    canReadEtlExecutions: true,
    canExecuteEtl: false,
    canManageEtlSchedules: true,
  });
  api.listEtlSchedules.mockResolvedValue([schedule]);
  api.listEtlProcesses.mockResolvedValue(processes);
});

describe('AdminEtlSchedulesPage', () => {
  it('lists schedules with their state and next fire', async () => {
    render(<AdminEtlSchedulesPage />);

    expect(await screen.findByText('Carga nocturna')).toBeTruthy();
    expect(screen.getByText('Activa')).toBeTruthy();
    expect(screen.getByText('0 0 2 * * *')).toBeTruthy();
  });

  it('blocks a schedule inside DSA hours and explains why', async () => {
    api.previewEtlSchedule.mockResolvedValue(preview(false));
    render(<AdminEtlSchedulesPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Nueva programación/ }));
    const dialog = await screen.findByRole('dialog');
    // Only schedulable processes are offered.
    expect(within(dialog).queryByRole('option', { name: 'Publicación' })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/Expresión cron/), { target: { value: '0 0 10 * * *' } });

    expect(await within(dialog).findByText(/cae dentro del horario operativo de la DSA/)).toBeTruthy();
    expect(within(dialog).getByText(/dentro del horario DSA/)).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Crear programación' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('creates a nightly schedule', async () => {
    api.previewEtlSchedule.mockResolvedValue(preview(true));
    api.createEtlSchedule.mockResolvedValue({ ...schedule, id: 9, name: 'Catálogo nocturno' });
    render(<AdminEtlSchedulesPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Nueva programación/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'Catálogo nocturno' } });
    await within(dialog).findByText('Fuera del horario operativo de la DSA.');
    const create = within(dialog).getByRole('button', { name: 'Crear programación' }) as HTMLButtonElement;
    await waitFor(() => expect(create.disabled).toBe(false));
    fireEvent.click(create);

    await waitFor(() =>
      expect(api.createEtlSchedule).toHaveBeenCalledWith({
        processCode: 'VERTICAL_LOAD',
        name: 'Catálogo nocturno',
        cronExpression: '0 0 2 * * *',
        timezone: 'America/La_Paz',
      }),
    );
    expect(await screen.findByText('Catálogo nocturno')).toBeTruthy();
  });

  it('pauses with the loaded version and shows the fire history, including skipped fires', async () => {
    api.setEtlScheduleEnabled.mockResolvedValue({ ...schedule, enabled: false, nextFireAt: null, rowVersion: 5 });
    api.listEtlLaunches.mockResolvedValue({
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          processCode: 'VERTICAL_LOAD',
          trigger: 'SCHEDULED',
          scheduleId: 3,
          closureId: null,
          runId: null,
          parameters: {},
          status: 'SKIPPED',
          active: false,
          hopExecutionId: null,
          requestedBy: 'scheduler:Carga nocturna',
          requestedAt: '2026-11-23T06:00:00Z',
          submittedAt: null,
          startedAt: null,
          finishedAt: '2026-11-23T06:00:00Z',
          stopRequestedBy: null,
          stopRequestedAt: null,
          resultSummary: 'No hay cierres académicos CERRADO pendientes de procesar',
          rowVersion: 1,
        },
      ],
      page: 0,
      size: 30,
      totalElements: 1,
      totalPages: 1,
    });
    render(<AdminEtlSchedulesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Pausar Carga nocturna' }));
    await waitFor(() => expect(api.setEtlScheduleEnabled).toHaveBeenCalledWith(3, false, 4));
    expect(await screen.findByText('Pausada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Historial de Carga nocturna' }));
    expect(await screen.findByText('No hay cierres académicos CERRADO pendientes de procesar')).toBeTruthy();
    expect(screen.getByText('Omitida')).toBeTruthy();
    expect(api.listEtlLaunches).toHaveBeenCalledWith({ scheduleId: 3, page: 0, size: 30 }, expect.anything());
  });
});
