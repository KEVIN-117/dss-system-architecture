import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requirePermissions } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requirePermissions: vi.fn(),
}));

vi.mock('../../../_lib/auth-guard', () => ({
  authenticateRequest,
  requirePermissions,
}));

import { GET as getStatus } from './status/route';
import { GET as listLaunches, POST as launch } from './launches/route';
import { POST as stop } from './launches/[launchId]/stop/route';
import { POST as createSchedule } from './schedules/route';
import { DELETE as deleteSchedule } from './schedules/[scheduleId]/route';
import { POST as disableSchedule } from './schedules/[scheduleId]/disable/route';

const LAUNCH_ID = '11111111-1111-4111-8111-111111111111';

const launchBody = {
  id: LAUNCH_ID,
  processCode: 'CATALOG_SYNC',
  trigger: 'MANUAL',
  scheduleId: null,
  closureId: null,
  runId: null,
  parameters: {},
  status: 'SUBMITTED',
  active: true,
  hopExecutionId: '33333333-3333-4333-8333-333333333333',
  requestedBy: 'authorized-subject',
  requestedAt: '2026-11-23T06:00:00Z',
  submittedAt: '2026-11-23T06:00:01Z',
  startedAt: null,
  finishedAt: null,
  stopRequestedBy: null,
  stopRequestedAt: null,
  resultSummary: null,
  rowVersion: 2,
};

const authenticated = {
  authenticated: true as const,
  value: {
    token: 'verified-jwt',
    user: { sub: 'authorized-subject' },
    roles: [],
    permissions: ['dw:etl-monitor:read', 'dw:etl:execute', 'dw:etl-schedule:manage'],
  },
};

function json(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) };
}

beforeEach(() => {
  vi.stubEnv('DW_CONTROL_SERVICE_URL', 'http://dw-control-service:8090');
  authenticateRequest.mockResolvedValue(authenticated);
  requirePermissions.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Load Manager BFF routes (LM-006)', () => {
  it('reads with dw:etl-monitor:read and forwards the verified token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ running: true, active: [launchBody] }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await getStatus(new Request('http://bff/api/admin/dw/etl/status'));

    expect(response.status).toBe(200);
    expect((await response.json()).running).toBe(true);
    expect(requirePermissions).toHaveBeenCalledWith(authenticated.value, ['dw:etl-monitor:read']);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://dw-control-service:8090/api/v1/etl/status');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer verified-jwt');
  });

  it('launches with dw:etl:execute and answers 201', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(launchBody, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await launch(
      json('POST', 'http://bff/api/admin/dw/etl/launches', { processCode: 'CATALOG_SYNC' }),
    );

    expect(response.status).toBe(201);
    expect((await response.json()).id).toBe(LAUNCH_ID);
    expect(requirePermissions).toHaveBeenCalledWith(authenticated.value, ['dw:etl:execute']);
  });

  it('rejects unknown fields and bad filters before calling the service', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const badBody = await launch(
      json('POST', 'http://bff/api/admin/dw/etl/launches', {
        processCode: 'CATALOG_SYNC',
        hopServer: 'http://evil',
      }),
    );
    const badFilter = await listLaunches(
      new Request('http://bff/api/admin/dw/etl/launches?status=DONE'),
    );
    const repeated = await listLaunches(
      new Request('http://bff/api/admin/dw/etl/launches?page=0&page=1'),
    );

    expect([badBody.status, badFilter.status, repeated.status]).toEqual([400, 400, 400]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the service without the required permission', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    requirePermissions.mockReturnValue(
      NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
    );

    const response = await stop(
      json('POST', `http://bff/api/admin/dw/etl/launches/${LAUNCH_ID}/stop`),
      params({ launchId: LAUNCH_ID }),
    );

    expect(response.status).toBe(403);
    expect(requirePermissions).toHaveBeenCalledWith(authenticated.value, ['dw:etl:execute']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops with 202', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(launchBody, { status: 202 })));

    const response = await stop(
      json('POST', `http://bff/api/admin/dw/etl/launches/${LAUNCH_ID}/stop`),
      params({ launchId: LAUNCH_ID }),
    );

    expect(response.status).toBe(202);
  });

  it('forwards the reason a schedule was rejected (DSA operating hours)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'BAD_REQUEST',
            detail: 'La ejecución del lunes 23/11/2026 10:00 cae dentro del horario operativo de la DSA',
          }),
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );

    const response = await createSchedule(
      json('POST', 'http://bff/api/admin/dw/etl/schedules', {
        processCode: 'CATALOG_SYNC',
        name: 'Mañana',
        cronExpression: '0 0 10 * * *',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid DW control request',
      code: 'DW_CONTROL_INVALID_REQUEST',
      detail: 'La ejecución del lunes 23/11/2026 10:00 cae dentro del horario operativo de la DSA',
    });
    expect(requirePermissions).toHaveBeenCalledWith(authenticated.value, ['dw:etl-schedule:manage']);
  });

  it('maps a Hop Server outage to 503 HOP_UNAVAILABLE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'HOP_UNAVAILABLE' }), {
          status: 503,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );

    const response = await launch(
      json('POST', 'http://bff/api/admin/dw/etl/launches', { processCode: 'CATALOG_SYNC' }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Hop Server is unavailable', code: 'HOP_UNAVAILABLE' });
  });

  it('pauses with the loaded rowVersion and deletes with an empty 204', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: 3,
          processCode: 'CATALOG_SYNC',
          name: 'Catálogo',
          cronExpression: '0 0 2 * * *',
          timezone: 'America/La_Paz',
          mode: 'NO_PARAMETERS',
          enabled: false,
          nextFireAt: null,
          lastFiredAt: null,
          lastLaunchId: null,
          firing: false,
          createdBy: 'authorized-subject',
          createdAt: '2026-11-23T06:00:00Z',
          updatedBy: 'authorized-subject',
          updatedAt: '2026-11-23T06:00:00Z',
          rowVersion: 2,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const paused = await disableSchedule(
      json('POST', 'http://bff/api/admin/dw/etl/schedules/3/disable', { rowVersion: 1 }),
      params({ scheduleId: '3' }),
    );
    const deleted = await deleteSchedule(
      new Request('http://bff/api/admin/dw/etl/schedules/3?rowVersion=2', { method: 'DELETE' }),
      params({ scheduleId: '3' }),
    );

    expect(paused.status).toBe(200);
    expect((await paused.json()).enabled).toBe(false);
    const [pauseUrl, pauseInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(pauseUrl.toString()).toBe('http://dw-control-service:8090/api/v1/etl/schedules/3/disable');
    expect(JSON.parse(pauseInit.body as string)).toEqual({ rowVersion: 1 });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');
  });
});
