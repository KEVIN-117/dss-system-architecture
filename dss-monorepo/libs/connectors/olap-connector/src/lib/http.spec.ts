import { afterEach, describe, expect, it, vi } from 'vitest';

import { olapFetch, OlapRequestTimeoutError, onAuthFailure } from './http.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('OLAP HTTP client', () => {
  it('uses the BFF proxy with the HttpOnly session cookie and no-store caching', async () => {
    vi.stubEnv('NEXT_PUBLIC_BFF_URL', 'http://localhost:3006/');
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await olapFetch('/rest/saiku/api/query/execute', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3006/api/olap/rest/saiku/api/query/execute',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('rejects URLs outside the Saiku API path', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(olapFetch('/admin/secrets')).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notifies listeners when the BFF session is unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    );
    const listener = vi.fn();
    const unsubscribe = onAuthFailure(listener);

    await olapFetch('/rest/saiku/api/query/execute', { method: 'POST' });

    expect(listener).toHaveBeenCalledWith(401, '/rest/saiku/api/query/execute');
    unsubscribe();
  });

  it('aborts requests that exceed the configured transport timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );

    const pending = olapFetch('/rest/saiku/api/query/execute');
    const assertion = expect(pending).rejects.toBeInstanceOf(
      OlapRequestTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });
});
