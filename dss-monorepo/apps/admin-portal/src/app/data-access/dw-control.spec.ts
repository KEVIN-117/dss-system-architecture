import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  closeAcademicPeriod,
  getDwClosureCapabilities,
  listAcademicClosures,
  reopenAcademicPeriod,
} from './dw-control';

afterEach(() => vi.unstubAllGlobals());

describe('DW control data access', () => {
  it('requests closure filters through the BFF session', async () => {
    const result = {
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      listAcademicClosures({
        gestion: 2026,
        periodo: 2,
        status: 'CERRADO',
        page: 1,
        size: 20,
      }),
    ).resolves.toEqual(result);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/admin/dw/academic-closures?page=1&size=20&gestion=2026&periodo=2&status=CERRADO',
      ),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('loads safe boolean capabilities without exposing a token', async () => {
    const capabilities = { canReadClosures: true, canManageClosures: false };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(capabilities), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwClosureCapabilities()).resolves.toEqual(capabilities);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).has('authorization')).toBe(false);
  });

  it('sends close and reopen reasons to their state-transition endpoints', async () => {
    const closure = { closureId: 7, status: 'CERRADO' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(closure), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(closure), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await closeAcademicPeriod(7, {
      effectiveAt: '2026-10-25T12:00:00.000Z',
      reason: 'Fin del periodo',
    });
    await reopenAcademicPeriod(7, { reason: 'Corrección autorizada' });

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      '/academic-closures/7/close',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      '/academic-closures/7/reopen',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      reason: 'Corrección autorizada',
    });
  });
});
