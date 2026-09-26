import { describe, expect, it, vi } from 'vitest';

import {
  AuthProfileError,
  fetchBffSession,
  parseBffSessionResponse,
} from './auth-api';

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

describe('BFF session contract', () => {
  it('parses the authenticated profile and DSS roles returned by the BFF', () => {
    expect(parseBffSessionResponse({
      user: profile,
      roles: ['DIRECTOR'],
      permissions: ['analytics:read', 'analytics:career'],
    })).toEqual({
      user: profile,
      roles: ['DIRECTOR'],
      permissions: ['analytics:read', 'analytics:career'],
    });
  });

  it('rejects an invalid profile, envelope or role set', () => {
    expect(() => parseBffSessionResponse({ data: profile, roles: ['DIRECTOR'], permissions: [] })).toThrow(
      AuthProfileError,
    );
    expect(() => parseBffSessionResponse({ user: profile, roles: ['NOT_A_DSS_ROLE'], permissions: [] })).toThrow(
      AuthProfileError,
    );
    expect(() => parseBffSessionResponse({ user: { ...profile, academicContexts: [{}] }, roles: [], permissions: [] })).toThrow(
      AuthProfileError,
    );
  });

  it('reads the profile through the BFF cookie without sending a token from the UI', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        user: profile,
        roles: ['RECTOR'],
        permissions: ['analytics:read'],
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBffSession('http://localhost:3006/')).resolves.toEqual({
      user: profile,
      roles: ['RECTOR'],
      permissions: ['analytics:read'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3006/api/auth/me',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }),
    );
    vi.unstubAllGlobals();
  });
});
