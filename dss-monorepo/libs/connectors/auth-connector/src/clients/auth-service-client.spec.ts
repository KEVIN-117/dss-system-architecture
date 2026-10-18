import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchUserProfile,
  replaceUserAcademicContexts,
} from './auth-service-client.js';

const profile = {
  id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
  username: 'maria',
  email: 'maria@uatf.edu.bo',
  firstName: 'María',
  lastName: 'Pérez',
  isActive: true,
  academicContexts: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchUserProfile', () => {
  it('consumes the plain auth-service profile using the bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(profile), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchUserProfile('http://localhost:8000/', 'access-token'),
    ).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('rejects non-success responses and malformed service contracts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 })),
    );
    await expect(
      fetchUserProfile('http://localhost:8000', 'access-token'),
    ).rejects.toMatchObject({
      name: 'AuthServiceClientError',
      status: 404,
    });
  });

  it('rejects a successful response that does not match the profile DTO', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ id: 'unexpected' })),
    );
    await expect(
      fetchUserProfile('http://localhost:8000', 'access-token'),
    ).rejects.toMatchObject({ name: 'AuthServiceClientError', status: 502 });
  });
});

describe('replaceUserAcademicContexts', () => {
  const userId = '6acb7476-663d-4c94-b3bd-9e5ac6db7f31';
  const contexts = [{ facultyId: 4, careerId: 'INF' }];
  const responseContexts = [
    {
      id: '0ec2e4dd-cb10-4ca2-95c0-4898f0575da2',
      userId,
      facultyId: 4,
      careerId: 'INF',
    },
  ];

  it('sends the superadmin operation with bearer auth and validates the returned DTOs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json(responseContexts));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      replaceUserAcademicContexts(
        'http://localhost:8000/',
        'verified-access-token',
        userId,
        { contexts },
      ),
    ).resolves.toEqual(responseContexts);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/admin/users/${userId}/academic-contexts`,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer verified-access-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ contexts }),
      }),
    );
  });

  it('rejects invalid assignments before making an upstream request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      replaceUserAcademicContexts('http://localhost:8000', 'token', userId, {
        contexts: [{ facultyId: 0, careerId: 'INF' }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the bounded request timeout to a gateway timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );

    const pending = replaceUserAcademicContexts(
      'http://localhost:8000',
      'token',
      userId,
      { contexts },
    );
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'AuthServiceClientError',
      status: 504,
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
