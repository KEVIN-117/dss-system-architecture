import { describe, expect, it, vi } from 'vitest';

import { AuthProfileError, fetchCurrentUser, parseAuthUserProfile } from './auth-api';

const USER_ID = '6acb7476-663d-4c94-b3bd-9e5ac6db7f31';
const CONTEXT_ID = '7f4f3174-98f1-4d5a-a8c8-4f3e2022b2c3';

const profile = {
  id: USER_ID,
  username: 'maria',
  email: 'maria@uatf.edu.bo',
  firstName: 'María',
  lastName: 'Pérez',
  isActive: true,
  academicContexts: [{
    id: CONTEXT_ID,
    userId: USER_ID,
    facultyId: 3,
    careerId: 12,
  }],
};

describe('auth-service profile contract', () => {
  it('parses the bare AuthUserProfile response returned by auth-service', () => {
    expect(parseAuthUserProfile(profile)).toEqual(profile);
  });

  it('rejects the obsolete data envelope and incomplete academic contexts', () => {
    expect(() => parseAuthUserProfile({ data: profile })).toThrow(AuthProfileError);
    expect(() => parseAuthUserProfile({ ...profile, academicContexts: [{}] })).toThrow(
      AuthProfileError,
    );
  });

  it('requests the API context path with a bearer token and no-store cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCurrentUser('http://localhost:8000/', 'access-token')).resolves.toEqual(profile);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/me',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('exposes an HTTP failure without accepting an unverified fallback profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not synchronized', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCurrentUser('http://localhost:8000', 'access-token')).rejects.toMatchObject({
      name: 'AuthProfileError',
      status: 404,
    });
    vi.unstubAllGlobals();
  });
});
