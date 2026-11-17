import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sealSession } from '../../_lib/session-cookie';
import { POST } from './route';

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.stubEnv('BFF_SESSION_SECRET', 'a-development-only-secret-that-is-not-committed');
    vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://localhost:3001');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the idle and absolute deadlines of the current session', async () => {
    const now = Math.floor(Date.now() / 1000);
    const session = await sealSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: now + 300,
      refreshTokenExpiresAt: now + 1800,
      createdAt: now - 60,
      lastActivityAt: now,
    });

    const response = await POST(
      new Request('http://localhost:3006/api/auth/refresh', {
        method: 'POST',
        headers: {
          cookie: `dss_session=${encodeURIComponent(session.value)}`,
          origin: 'http://localhost:3001',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3001');
    await expect(response.json()).resolves.toEqual({
      expiresAt: (now + 1800) * 1000,
      absoluteExpiresAt: (now - 60 + 36_000) * 1000,
      idleTimeoutSeconds: 1800,
    });
  });

  it('returns 401 without a valid session', async () => {
    const response = await POST(
      new Request('http://localhost:3006/api/auth/refresh', { method: 'POST' }),
    );

    expect(response.status).toBe(401);
  });
});
