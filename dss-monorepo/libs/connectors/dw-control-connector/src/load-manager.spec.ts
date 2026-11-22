import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createEtlSchedule,
  deleteEtlSchedule,
  getEtlLaunchLogs,
  getEtlStatus,
  launchEtlProcess,
  listEtlLaunches,
  previewEtlSchedule,
  setEtlScheduleEnabled,
  type DwControlServiceConfig,
  type EtlLaunch,
  type EtlSchedule,
} from './server';

const config: DwControlServiceConfig = {
  baseUrl: 'http://dw-control-service:8090',
  accessToken: 'verified-user-token',
  timeoutMs: 2_000,
};

const launch: EtlLaunch = {
  id: '11111111-1111-4111-8111-111111111111',
  processCode: 'VERTICAL_LOAD',
  trigger: 'MANUAL',
  scheduleId: null,
  closureId: 7,
  runId: '22222222-2222-4222-8222-222222222222',
  parameters: { P_RUN_ID: '22222222-2222-4222-8222-222222222222', P_REQUESTED_GESTION: '2026' },
  status: 'SUBMITTED',
  active: true,
  hopExecutionId: '33333333-3333-4333-8333-333333333333',
  requestedBy: 'operator-1',
  requestedAt: '2026-11-23T06:00:00Z',
  submittedAt: '2026-11-23T06:00:01Z',
  startedAt: null,
  finishedAt: null,
  stopRequestedBy: null,
  stopRequestedAt: null,
  resultSummary: null,
  rowVersion: 2,
};

const schedule: EtlSchedule = {
  id: 3,
  processCode: 'CATALOG_SYNC',
  name: 'Catálogo nocturno',
  cronExpression: '0 0 2 * * *',
  timezone: 'America/La_Paz',
  mode: 'NO_PARAMETERS',
  enabled: true,
  nextFireAt: '2026-11-24T06:00:00Z',
  lastFiredAt: null,
  lastLaunchId: null,
  firing: false,
  createdBy: 'operator-1',
  createdAt: '2026-11-23T06:00:00Z',
  updatedBy: 'operator-1',
  updatedAt: '2026-11-23T06:00:00Z',
  rowVersion: 1,
};

function problem(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('dw-control connector: Load Manager', () => {
  it('posts only the allowlisted launch fields and keeps only allowlisted response fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ ...launch, logExcerpt: 'must not escape' }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await launchEtlProcess(config, {
      processCode: 'VERTICAL_LOAD',
      executionKind: 'CIERRE_ACADEMICO',
      closureId: 7,
    });

    expect(result).toEqual(launch);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://dw-control-service:8090/api/v1/etl/launches');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      processCode: 'VERTICAL_LOAD',
      executionKind: 'CIERRE_ACADEMICO',
      closureId: 7,
    });
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer verified-user-token');
  });

  it('validates inputs before calling the service', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(() => launchEtlProcess(config, { processCode: 'not a code' })).toThrow();
    expect(() => listEtlLaunches(config, { status: 'DONE' as never })).toThrow();
    expect(() =>
      createEtlSchedule(config, { processCode: 'CATALOG_SYNC', name: 'x', cronExpression: '0 2 * * *' }),
    ).toThrow();
    expect(() => setEtlScheduleEnabled(config, 3, true, 0)).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the schedule validation reason of a 400 so the portal can show it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        problem(400, {
          code: 'BAD_REQUEST',
          detail: 'La ejecución del lunes 23/11/2026 10:00 cae dentro del horario operativo de la DSA',
        }),
      ),
    );

    await expect(
      createEtlSchedule(config, {
        processCode: 'CATALOG_SYNC',
        name: 'Mañana',
        cronExpression: '0 0 10 * * *',
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'DW_CONTROL_INVALID_REQUEST',
      message: 'dw-control-service request failed',
      detail: 'La ejecución del lunes 23/11/2026 10:00 cae dentro del horario operativo de la DSA',
    });
  });

  it('drops upstream details that look like internal data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(problem(400, { detail: 'org.postgresql.util.PSQLException: password=x' })),
    );

    await expect(
      createEtlSchedule(config, { processCode: 'CATALOG_SYNC', name: 'x', cronExpression: '0 0 2 * * *' }),
    ).rejects.toMatchObject({ status: 400, detail: undefined });
  });

  it('keeps the Hop Server outage code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(problem(503, { code: 'HOP_UNAVAILABLE', detail: 'Hop down at http://x' })),
    );

    await expect(launchEtlProcess(config, { processCode: 'CATALOG_SYNC' })).rejects.toMatchObject({
      status: 503,
      code: 'HOP_UNAVAILABLE',
      detail: undefined,
    });
  });

  it('handles the empty 204 of a schedule deletion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteEtlSchedule(config, 3, 2)).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://dw-control-service:8090/api/v1/etl/schedules/3?rowVersion=2');
    expect(init.method).toBe('DELETE');
  });

  it('parses status, logs, schedules and previews strictly', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ running: true, active: [launch] }))
        .mockResolvedValueOnce(
          Response.json({ launchId: launch.id, status: 'RUNNING', active: true, log: 'línea' }),
        )
        .mockResolvedValueOnce(Response.json({ ...schedule, enabled: false, rowVersion: 2 }))
        .mockResolvedValueOnce(
          Response.json({
            cronExpression: '0 0 9 * * *',
            timezone: 'America/La_Paz',
            operatingWindow: 'lunes a viernes 08:00–18:00',
            valid: false,
            validationMessage: 'cae dentro del horario operativo',
            occurrences: [{ at: '2026-11-23T13:00:00Z', insideOperatingWindow: true }],
          }),
        )
        .mockResolvedValueOnce(Response.json({ running: true, active: [{ ...launch, status: 'DONE' }] })),
    );

    expect((await getEtlStatus(config)).active[0].id).toBe(launch.id);
    expect((await getEtlLaunchLogs(config, launch.id)).log).toBe('línea');
    expect((await setEtlScheduleEnabled(config, 3, false, 1)).enabled).toBe(false);
    expect((await previewEtlSchedule(config, { cronExpression: '0 0 9 * * *' })).valid).toBe(false);
    await expect(getEtlStatus(config)).rejects.toMatchObject({ code: 'DW_CONTROL_INVALID_RESPONSE' });
  });
});
