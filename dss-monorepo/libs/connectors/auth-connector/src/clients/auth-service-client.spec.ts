import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchUserProfile } from './auth-service-client.js';

const profile = {
  id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
  username: 'maria',
  email: 'maria@uatf.edu.bo',
  firstName: 'María',
  lastName: 'Pérez',
  isActive: true,
  academicContexts: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('fetchUserProfile', () => {
  it('consumes the plain auth-service profile using the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchUserProfile('http://localhost:8000/', 'access-token')).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('rejects non-success responses and malformed service contracts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(fetchUserProfile('http://localhost:8000', 'access-token')).rejects.toMatchObject({
      name: 'AuthServiceClientError',
      status: 404,
    });
  });
});
