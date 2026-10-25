import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DwControlClientError,
  listAcademicClosures,
  getEtlExecution,
  type AcademicClosure,
  type DwControlServiceConfig,
} from './server';

const config: DwControlServiceConfig = {
  baseUrl: 'http://dw-control-service:8090',
  accessToken: 'verified-user-token',
  timeoutMs: 2_000,
};

const closure: AcademicClosure = {
  closureId: 12,
  gestion: 2026,
  periodo: 1,
  status: 'CERRADO',
  effectiveAt: '2026-01-15T10:00:00Z',
  authorizedBySubject: 'user-subject',
  createdBySubject: 'user-subject',
  closureReason: 'Cierre aprobado',
  version: 2,
  processedRunId: null,
  processedAt: null,
  createdAt: '2026-01-15T09:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('dw-control-service server connector', () => {
  it('forwards the verified bearer token, pagination and only allowlisted closure fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        items: [{ ...closure, internalStackTrace: 'must not escape' }],
        page: 1,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        privateMetadata: 'must not escape',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listAcademicClosures(config, {
      gestion: 2026,
      page: 1,
      size: 10,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'http://dw-control-service:8090/api/v1/academic-closures?gestion=2026&page=1&size=10',
    );
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer verified-user-token',
    );
    expect(init.cache).toBe('no-store');
    expect(result.items).toEqual([closure]);
    expect(result).not.toHaveProperty('privateMetadata');
  });

  it('maps upstream errors without returning their response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: 'database password is secret' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );

    await expect(listAcademicClosures(config)).rejects.toMatchObject({
      status: 403,
      code: 'DW_CONTROL_FORBIDDEN',
      message: 'dw-control-service request failed',
    });
  });

  it('rejects malformed upstream DTOs and never exposes unapproved execution error text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          runId: '248c6e1c-ff2e-45ab-9ddc-dcf501220b9a',
          executionKind: 'HISTORICA',
          status: 'FALLIDA',
          closureId: null,
          requestedGestion: 2026,
          requestedPeriodo: 1,
          requestedBy: 'subject',
          requestedAt: '2026-01-15T09:00:00Z',
          startedAt: null,
          endedAt: null,
          steps: [],
          metrics: [],
          errors: [
            {
              severity: 'ERROR',
              code: 'DB_FAILURE',
              message: 'password=secret',
              stepCode: null,
              occurredAt: '2026-01-15T09:00:00Z',
            },
          ],
          internalException: 'private stack trace',
        }),
      ),
    );

    await expect(
      getEtlExecution(config, '248c6e1c-ff2e-45ab-9ddc-dcf501220b9a'),
    ).rejects.toMatchObject({
      status: 502,
      code: 'DW_CONTROL_INVALID_RESPONSE',
    });
  });

  it('maps network failures to a safe unavailable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection details')),
    );

    await expect(listAcademicClosures(config)).rejects.toBeInstanceOf(
      DwControlClientError,
    );
    await expect(listAcademicClosures(config)).rejects.toMatchObject({
      status: 503,
      code: 'DW_CONTROL_UNAVAILABLE',
    });
  });
});
