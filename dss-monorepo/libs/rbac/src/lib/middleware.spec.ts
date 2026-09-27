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
        resolvePrincipal: () => ({ roles: ['DIRECTOR'] }),
      },
      handler,
    );

    const response = await middleware(new Request('http://localhost/api/reports'));

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows inherited role and permission policies while keeping SUPERADMIN technical', async () => {
    expect(isRbacAllowed(['RECTOR'], { roles: ['DIRECTOR'] })).toBe(true);
    expect(isRbacAllowed(['SUPERADMIN'], { permissions: ['analytics:global'] })).toBe(false);

    const handler = vi.fn(() => new Response('allowed'));
    const middleware = withRbacMiddleware(
      {
        permissions: ['pipelines:execute'],
        resolvePrincipal: () => ({ roles: ['SUPERADMIN'] }),
      },
      handler,
    );

    const response = await middleware(new Request('http://localhost/api/pipelines'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('allowed');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
