import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AuthServiceClientError,
  AuthServiceIamError,
  callAuthServiceIam,
} from './auth-service-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(status: number, body?: unknown, contentType = 'application/json') {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: body === undefined ? {} : { 'content-type': contentType },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** IAM-015: the BFF forwards IAM calls with the user's own token. */
describe('callAuthServiceIam', () => {
  it('forwards method, path, query, body and the user bearer token', async () => {
    const fetchMock = respond(201, { name: 'VICERRECTOR' });

    const result = await callAuthServiceIam('http://auth-service:8000/', 'user-token', {
      method: 'POST',
      path: '/admin/iam/roles',
      query: new URLSearchParams({ force: 'true' }),
      body: { name: 'VICERRECTOR' },
    });

    expect(result).toEqual({ status: 201, body: { name: 'VICERRECTOR' } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://auth-service:8000/api/v1/admin/iam/roles?force=true');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"VICERRECTOR"}');
    expect(init.redirect).toBe('manual');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer user-token');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('sends no body or content type for reads and returns null for empty responses', async () => {
    const fetchMock = respond(204);

    expect(await callAuthServiceIam('http://auth-service:8000', 't', {
      method: 'DELETE', path: '/admin/iam/permissions/reports%3Aexport',
    })).toEqual({ status: 204, body: null });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('content-type')).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://auth-service:8000/api/v1/admin/iam/permissions/reports%3Aexport');
  });

  it('keeps the domain message of a 4xx and hides the body of a 5xx', async () => {
    respond(409, { title: 'IamRuleViolationException', detail: 'El rol DECANO es del sistema.', instance: '/x' });
    await expect(callAuthServiceIam('http://a', 't', { method: 'DELETE', path: '/admin/iam/roles/DECANO' }))
      .rejects.toMatchObject({ status: 409, title: 'IamRuleViolationException', detail: 'El rol DECANO es del sistema.' });

    respond(502, { title: 'IdentityProviderException', detail: 'internal keycloak detail' });
    const error = await callAuthServiceIam('http://a', 't', { method: 'GET', path: '/admin/iam/roles' })
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AuthServiceIamError);
    expect(error).toMatchObject({ status: 502, title: null, detail: null });
  });

  it('tolerates a 4xx without a problem body', async () => {
    respond(403, 'forbidden', 'text/plain');
    await expect(callAuthServiceIam('http://a', 't', { method: 'GET', path: '/admin/iam/audit' }))
      .rejects.toMatchObject({ status: 403, title: null, detail: null });
  });

  it('rejects paths outside the IAM API before calling auth-service', async () => {
    const fetchMock = respond(200, {});
    for (const path of ['/admin/users', '/admin/iam/../users', '/admin/iam/roles?x=1', '/admin/iam/roles#a']) {
      await expect(callAuthServiceIam('http://a', 't', { method: 'GET', path })).rejects.toBeInstanceOf(
        AuthServiceClientError,
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an unparsable success body as a bad gateway', async () => {
    respond(200, '{not json');
    await expect(callAuthServiceIam('http://a', 't', { method: 'GET', path: '/admin/iam/roles' }))
      .rejects.toMatchObject({ status: 502 });
  });

  it('maps an unreachable auth-service to 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(callAuthServiceIam('http://a', 't', { method: 'GET', path: '/admin/iam/roles' }))
      .rejects.toMatchObject({ status: 503 });
  });
});
