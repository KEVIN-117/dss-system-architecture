import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LoadManagerError,
  createEtlSchedule,
  deleteEtlSchedule,
  launchEtlProcess,
  listEtlLaunches,
  previewEtlSchedule,
} from './load-manager';

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('load-manager data access', () => {
  it('sends filters as query parameters with the session cookie', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond(200, { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await listEtlLaunches({ scheduleId: 3, status: 'SKIPPED', page: 0, size: 20 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/admin/dw/etl/launches?page=0&size=20&status=SKIPPED&scheduleId=3');
    expect(init.credentials).toBe('include');
  });

  it('shows the reason dw-control-service gave for a rejected schedule', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond(400, {
          error: 'Invalid DW control request',
          code: 'DW_CONTROL_INVALID_REQUEST',
          detail: 'La ejecución del lunes 23/11/2026 10:00 cae dentro del horario operativo de la DSA',
        }),
      ),
    );

    await expect(
      createEtlSchedule({ processCode: 'CATALOG_SYNC', name: 'x', cronExpression: '0 0 10 * * *' }),
    ).rejects.toThrow('cae dentro del horario operativo de la DSA');
  });

  it('explains Hop Server outages and conflicts in Spanish', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(respond(503, { error: 'Hop Server is unavailable', code: 'HOP_UNAVAILABLE' }))
        .mockResolvedValueOnce(respond(409, { error: 'DW operation conflicts', code: 'DW_CONTROL_CONFLICT' })),
    );

    const outage = launchEtlProcess({ processCode: 'CATALOG_SYNC' });
    await expect(outage).rejects.toBeInstanceOf(LoadManagerError);
    await expect(outage).rejects.toThrow('Hop Server no está disponible');
    await expect(launchEtlProcess({ processCode: 'CATALOG_SYNC' })).rejects.toThrow(
      'puede haber una ejecución activa',
    );
  });

  it('handles the empty 204 of a deletion and encodes the preview expression', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(respond(200, { valid: true, occurrences: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteEtlSchedule(3, 2)).resolves.toBeNull();
    await previewEtlSchedule(' 0 0 2 * * * ', 'America/La_Paz', 4);

    expect(fetchMock.mock.calls[0][0]).toContain('/api/admin/dw/etl/schedules/3?rowVersion=2');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
    expect(fetchMock.mock.calls[1][0]).toContain(
      'schedules/preview?cronExpression=0+0+2+*+*+*&count=4&timezone=America%2FLa_Paz',
    );
  });
});
