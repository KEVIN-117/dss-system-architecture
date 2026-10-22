import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchUserProfile,
  getAcademicCatalog,
  getAdminUser,
  listAdminUsers,
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

  it('maps a network failure to service unavailable without exposing fetch details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(
      fetchUserProfile('http://localhost:8000', 'access-token'),
    ).rejects.toMatchObject({
      name: 'AuthServiceClientError',
      status: 503,
      message: 'auth-service is unavailable',
    });
  });
});

describe('admin directory client', () => {
  const userId = '6acb7476-663d-4c94-b3bd-9e5ac6db7f31';
  const directoryUser = {
    id: userId,
    username: 'maria',
    email: 'maria@uatf.edu.bo',
    firstName: 'María',
    lastName: 'Pérez',
    isActive: true,
    roles: ['DIRECTOR'],
    academicContexts: [],
  };

  it('lists paginated users with filters and strips unexpected upstream fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        content: [{ ...directoryUser, providerSecret: 'must-not-leak' }],
        page: 1,
        size: 10,
        totalElements: 11,
        totalPages: 2,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      listAdminUsers('http://localhost:8000/', 'verified-token', {
        q: '  maria ',
        active: true,
        role: 'DIRECTOR',
        page: 1,
        size: 10,
      }),
    ).resolves.toEqual({
      content: [directoryUser],
      page: 1,
      size: 10,
      totalElements: 11,
      totalPages: 2,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/admin/users?q=maria&active=true&role=DIRECTOR&page=1&size=10',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer verified-token',
        }),
      }),
    );
  });

  it('loads a user by the local UUID and rejects malformed identifiers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(directoryUser));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getAdminUser('http://localhost:8000', 'verified-token', userId),
    ).resolves.toEqual(directoryUser);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8000/api/v1/admin/users/${userId}`,
      expect.any(Object),
    );
    await expect(
      getAdminUser('http://localhost:8000', 'verified-token', 'not-a-uuid'),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loads catalog options and rejects invalid directory query bounds', async () => {
    const catalog = {
      faculties: [
        { id: 0, name: 'Artes' },
        { id: 4, name: 'Ingeniería' },
      ],
      careers: [{ id: 'INF', name: 'Sistemas', facultyId: 4 }],
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(catalog));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getAcademicCatalog('http://localhost:8000', 'verified-token'),
    ).resolves.toEqual(catalog);
    await expect(
      listAdminUsers('http://localhost:8000', 'verified-token', {
        page: -1,
        size: 501,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('accepts zero as a valid academic faculty ID', async () => {
    const zeroFacultyContext = [{
      id: '0ec2e4dd-cb10-4ca2-95c0-4898f0575da2',
      userId,
      facultyId: 0,
      careerId: null,
    }];
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(Response.json(zeroFacultyContext));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      replaceUserAcademicContexts('http://localhost:8000', 'token', userId, {
        contexts: [{ facultyId: 0, careerId: null }],
      }),
    ).resolves.toEqual(zeroFacultyContext);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
