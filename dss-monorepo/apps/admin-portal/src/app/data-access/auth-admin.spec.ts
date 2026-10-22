import { afterEach, describe, expect, it, vi } from 'vitest';

import { listAdminUsers, replaceAdminUserContexts } from './auth-admin';

afterEach(() => vi.unstubAllGlobals());

describe('Auth Service administration data access', () => {
  it('loads a paginated directory using the BFF session cookie', async () => {
    const response = {
      content: [{
        id: '123e4567-e89b-42d3-a456-426614174000',
        username: 'ana',
        email: 'ana@example.edu',
        firstName: 'Ana',
        lastName: 'García',
        isActive: true,
        roles: ['DIRECTOR'],
        academicContexts: [],
      }],
      page: 2,
      size: 20,
      totalElements: 41,
      totalPages: 3,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listAdminUsers({ q: 'ana', role: 'DIRECTOR', active: true, page: 2, size: 20 }))
      .resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/users?page=2&size=20&q=ana&role=DIRECTOR&active=true'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).has('authorization')).toBe(false);
  });

  it('replaces academic context through the BFF without exposing a bearer token', async () => {
    const contexts = [{ id: 'context-1', userId: '123e4567-e89b-42d3-a456-426614174000', facultyId: 8, careerId: '202' }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(contexts), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(replaceAdminUserContexts(contexts[0].userId, [{ facultyId: 8, careerId: '202' }]))
      .resolves.toEqual(contexts);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/users/123e4567-e89b-42d3-a456-426614174000/academic-contexts'),
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({ contexts: [{ facultyId: 8, careerId: '202' }] }),
      }),
    );
  });
});
