import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sealSession } from './app/api/_lib/session-cookie';
import { resetSessionRefreshCache } from './app/api/_lib/session-refresh';
import { proxy } from './proxy';

const SECRET = 'a-development-only-secret-that-is-not-committed';

function stubKeycloakEnvironment(): void {
  vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://localhost:3001');
  vi.stubEnv('BFF_DEFAULT_POST_LOGIN_REDIRECT_URI', 'http://localhost:3001');
  vi.stubEnv('KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI', 'http://localhost:3001/login');
  vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8000');
  vi.stubEnv('KEYCLOAK_URL', 'http://keycloak:8080');
  vi.stubEnv('KEYCLOAK_REALM', 'uatf-dss-realm');
  vi.stubEnv('KEYCLOAK_AUDIENCE', 'uatf-auth-service');
  vi.stubEnv('KEYCLOAK_ROLE_CLIENT_ID', 'uatf-auth-service');
  vi.stubEnv('KEYCLOAK_BFF_CLIENT_ID', 'dss-bff');
  vi.stubEnv('KEYCLOAK_BFF_CLIENT_SECRET', 'confidential');
  vi.stubEnv('KEYCLOAK_BFF_REDIRECT_URI', 'http://localhost:3006/api/auth/callback');
}

function cookieRequest(path: string, value: string, method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost:3006${path}`, {
    method,
    headers: { Cookie: `other=1; dss_session=${encodeURIComponent(value)}` },
  });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('BFF proxy', () => {
  beforeEach(() => {
    vi.stubEnv('BFF_SESSION_SECRET', SECRET);
    resetSessionRefreshCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects API calls without a bearer token', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3006/api/auth/me'),
    );

    expect(response.status).toBe(401);
  });

  it('allows the OAuth start and callback routes before a session exists', async () => {
    const status = async (path: string, method = 'GET') =>
      (await proxy(new NextRequest(`http://localhost:3006${path}`, { method }))).status;

    expect(await status('/api/auth/login')).toBe(200);
    expect(await status('/api/auth/callback')).toBe(200);
    expect(await status('/api/auth/logout')).toBe(200);
    expect(await status('/api/auth/logout', 'POST')).toBe(401);
    expect(await status('/api/auth/me')).toBe(401);
  });

  it('allows the readiness endpoint without exposing authenticated API routes', async () => {
    expect(
      (await proxy(new NextRequest('http://localhost:3006/api/health'))).status,
    ).toBe(200);
    expect(
      (
        await proxy(
          new NextRequest('http://localhost:3006/api/health', { method: 'POST' }),
        )
      ).status,
    ).toBe(401);
  });

  it('allows CORS preflight only for configured dashboard origins', async () => {
    vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://localhost:3001');
    const response = await proxy(
      new NextRequest('http://localhost:3006/api/auth/me', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3001' },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3001',
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true',
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'Idempotency-Key',
    );
  });

  it('allows API calls authenticated by a valid BFF session cookie', async () => {
    const session = await sealSession({ accessToken: 'access-token' });
    const response = await proxy(cookieRequest('/api/auth/me', session.value));

    expect(response.status).toBe(200);
    expect(response.cookies.get('dss_session')).toBeUndefined();
  });

  it('rejects and clears a forged session cookie', async () => {
    const response = await proxy(cookieRequest('/api/auth/me', 'encrypted-session'));

    expect(response.status).toBe(401);
    expect(response.cookies.get('dss_session')?.maxAge).toBe(0);
  });

  it('renews an expiring access token once and forwards the new cookie', async () => {
    stubKeycloakEnvironment();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'renewed-access-token',
          refresh_token: 'rotated-refresh-token',
          expires_in: 300,
          refresh_expires_in: 1800,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const now = nowSeconds();
    const session = await sealSession({
      accessToken: 'old-access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: now + 10,
      refreshTokenExpiresAt: now + 1500,
      createdAt: now - 600,
      lastActivityAt: now - 60,
    });

    const responses = await Promise.all([
      proxy(cookieRequest('/api/auth/me', session.value)),
      proxy(cookieRequest('/api/olap/cubes', session.value)),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const response of responses) {
      expect(response.status).toBe(200);
      const renewed = response.cookies.get('dss_session');
      expect(renewed?.httpOnly).toBe(true);
      expect(renewed?.value).not.toBe(session.value);
      expect(renewed?.value).not.toContain('renewed-access-token');
      // Next forwards the overridden request cookie to the route handler.
      expect(response.headers.get('x-middleware-request-cookie')).toContain('other=1');
    }
  });

  it('ends the session when Keycloak rejects the refresh token', async () => {
    stubKeycloakEnvironment();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
      ),
    );
    const now = nowSeconds();
    const session = await sealSession({
      accessToken: 'old-access-token',
      refreshToken: 'revoked-refresh-token',
      accessTokenExpiresAt: now + 5,
      refreshTokenExpiresAt: now + 1500,
    });

    const response = await proxy(cookieRequest('/api/auth/me', session.value));

    expect(response.status).toBe(401);
    expect(response.cookies.get('dss_session')?.maxAge).toBe(0);
  });

  it('keeps the session through a transient Keycloak outage while the token is valid', async () => {
    stubKeycloakEnvironment();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const now = nowSeconds();
    const valid = await sealSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: now + 30,
      refreshTokenExpiresAt: now + 1500,
    });

    expect((await proxy(cookieRequest('/api/auth/me', valid.value))).status).toBe(200);
  });

  it('extends the idle window only on the activity heartbeat', async () => {
    const now = nowSeconds();
    const session = await sealSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: now + 240,
      refreshTokenExpiresAt: now + 1800,
      createdAt: now - 900,
      lastActivityAt: now - 900,
    });

    const passive = await proxy(cookieRequest('/api/auth/me', session.value));
    expect(passive.cookies.get('dss_session')).toBeUndefined();

    const heartbeat = await proxy(
      cookieRequest('/api/auth/refresh', session.value, 'POST'),
    );
    expect(heartbeat.status).toBe(200);
    expect(heartbeat.cookies.get('dss_session')?.maxAge).toBe(1800);
  });

  it('rejects a session idle for longer than the configured timeout', async () => {
    const now = nowSeconds();
    const sealedAt = now - 1801;
    const session = await sealSession(
      {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: sealedAt + 300,
        refreshTokenExpiresAt: now + 60_000,
        createdAt: sealedAt,
        lastActivityAt: sealedAt,
      },
      sealedAt,
    );

    const response = await proxy(
      cookieRequest('/api/auth/refresh', session.value, 'POST'),
    );
    expect(response.status).toBe(401);
  });

  it('rejects a session past its absolute lifetime despite recent activity', async () => {
    const now = nowSeconds();
    const session = await sealSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: now + 240,
      refreshTokenExpiresAt: now + 1800,
      createdAt: now - 36_001,
      lastActivityAt: now - 10,
    });

    const response = await proxy(
      cookieRequest('/api/auth/refresh', session.value, 'POST'),
    );
    expect(response.status).toBe(401);
  });
});
