import { afterEach, describe, expect, it, vi } from 'vitest';

import { listOlapSchemas } from './olap-admin';

afterEach(() => vi.unstubAllGlobals());

describe('OLAP administration data access', () => {
  it('loads schemas through the authenticated BFF without sending browser tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('[{"name":"academic.xml"}]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listOlapSchemas()).resolves.toEqual([
      { name: 'academic.xml' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/olap/rest/saiku/admin/schema'),
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
      }),
    );
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).has('authorization')).toBe(false);
  });

  it('does not expose upstream response bodies in the portal error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('internal token=do-not-display', { status: 502 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = listOlapSchemas();
    await expect(request).rejects.toThrow(
      'OLAP administration request failed (502)',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
