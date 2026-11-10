import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  executeServerOlapQuery,
  getServerOlapCubeSchema,
  listServerOlapCubes,
  OlapServerClientError,
} from './server.js';

const config = { baseUrl: 'http://olap-service:8080/', accessToken: 'server-token' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('server-only OLAP transport', () => {
  it('sends live cube discovery through a bearer-authenticated server request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listServerOlapCubes(config)).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://olap-service:8080/rest/saiku/api/ai/cubes');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer server-token');
    expect(init.cache).toBe('no-store');
    expect(init.redirect).toBe('manual');
  });

  it('encodes cube path segments and posts a typed analytics query', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ schema: 'live-schema' }))
      .mockResolvedValueOnce(Response.json({ status: 'SUCCESS', data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getServerOlapCubeSchema(config, 'academic/UATF Main/UATF/Students');
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://olap-service:8080/rest/saiku/api/ai/schema/academic/UATF%20Main/UATF/Students',
    );

    const query = { cube: 'academic/UATF/UATF/Students', measures: [{ name: 'Students' }] };
    await executeServerOlapQuery(config, query);
    const [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(String(url)).toBe('http://olap-service:8080/rest/saiku/api/ai/query?format=records');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(query);
  });

  it('rejects malformed cube identifiers and hides upstream error bodies', async () => {
    await expect(Promise.resolve().then(() => getServerOlapCubeSchema(config, '../admin/secrets')))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT', status: 400 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret backend trace', { status: 403 })));
    const error = await listServerOlapCubes(config).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OlapServerClientError);
    expect(error).toMatchObject({ message: 'OLAP request failed', code: 'OLAP_FORBIDDEN', status: 403 });
  });

  it('preserves only the field name from a structured query validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            status: 'VALIDATION_ERROR',
            field: 'filters[0].hierarchy',
            error: 'Do not expose this backend detail',
            available: ['sensitive-member'],
          },
          { status: 400 },
        ),
      ),
    );

    const error = await executeServerOlapQuery(config, {
      cube: 'academic/UATF/UATF/Academic Performance',
      measures: [{ name: 'Enrollment Attempts' }],
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OlapServerClientError);
    expect(error).toMatchObject({
      code: 'OLAP_INVALID_QUERY',
      status: 400,
      field: 'filters[0].hierarchy',
    });
    expect((error as Error).message).not.toContain('sensitive-member');
    expect((error as Error).message).not.toContain('Do not expose');
  });

  it('normalizes network errors and request timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('socket closed')));
    await expect(listServerOlapCubes(config)).rejects.toMatchObject({
      message: 'OLAP service is unavailable', code: 'OLAP_UNAVAILABLE', status: 502,
    });

    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = listServerOlapCubes({ ...config, timeoutMs: 25 });
    const assertion = expect(pending).rejects.toMatchObject({
      message: 'OLAP request timed out', code: 'OLAP_TIMEOUT', status: 504,
    });
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });
});
