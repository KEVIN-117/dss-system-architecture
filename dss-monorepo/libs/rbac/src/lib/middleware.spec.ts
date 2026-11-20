import { describe, expect, it, vi } from 'vitest';

import {
  isRbacAllowed,
  withRbacMiddleware,
} from '../server';

describe('server RBAC middleware', () => {
  it('returns 401 when the principal resolver cannot authenticate the request', async () => {
    const handler = vi.fn(() => new Response('allowed'));
    const middleware = withRbacMiddleware(
      {
        roles: ['RECTOR'],
        resolvePrincipal: () => null,
      },
      handler,
    );

    const response = await middleware(new Request('http://localhost/api/reports'));

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when an authenticated principal lacks the required role', async () => {
    const handler = vi.fn(() => new Response('allowed'));
    const middleware = withRbacMiddleware(
      {
        roles: ['RECTOR'],
        resolvePrincipal: () => ({ roles: ['DIRECTOR'], permissions: [] }),
      },
      handler,
    );

    const response = await middleware(new Request('http://localhost/api/reports'));

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('checks portal roles through the hierarchy and permissions from the token only', async () => {
    expect(isRbacAllowed({ roles: ['RECTOR'], permissions: [] }, { roles: ['DIRECTOR'] })).toBe(true);
    // IAM-014: a role grants no permission by itself.
    expect(isRbacAllowed({ roles: ['RECTOR'], permissions: [] }, { permissions: ['analytics:global'] })).toBe(false);
    expect(
      isRbacAllowed({ roles: ['SUPERADMIN'], permissions: ['iam:users:read'] }, { permissions: ['analytics:global'] }),
    ).toBe(false);

    const handler = vi.fn(() => new Response('allowed'));
    const middleware = withRbacMiddleware(
      {
        permissions: ['pipelines:execute'],
        resolvePrincipal: () => ({ roles: [], permissions: ['pipelines:execute'] }),
      },
      handler,
    );

    const response = await middleware(new Request('http://localhost/api/pipelines'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('allowed');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
