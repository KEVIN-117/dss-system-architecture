import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('../_lib/auth-guard', () => ({ authenticateRequest }));

import { createGraphQLContext } from './context';

describe('GraphQL authentication context', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('validates the incoming request and exposes its authentication to resolvers', async () => {
    const authentication = {
      token: 'forwarded-access-token',
      roles: ['DIRECTOR'],
      user: { id: 'user-1', roles: ['DIRECTOR'] },
    };
    authenticateRequest.mockResolvedValue({ authenticated: true, value: authentication });
    const request = new Request('http://localhost:3006/api/graphql', {
      headers: { authorization: 'Bearer forwarded-access-token' },
    });

    await expect(createGraphQLContext(request)).resolves.toEqual({ authentication });
    expect(authenticateRequest).toHaveBeenCalledWith(request);
  });

  it('rejects requests that do not have a valid session or token', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: false,
      response: Response.json({ error: 'Authentication required' }, { status: 401 }),
    });

    await expect(createGraphQLContext(new Request('http://localhost:3006/api/graphql')))
      .rejects.toMatchObject({
        message: 'Authentication required',
        extensions: {
          code: 'UNAUTHENTICATED',
          http: { status: 401 },
        },
      });
  });
});
