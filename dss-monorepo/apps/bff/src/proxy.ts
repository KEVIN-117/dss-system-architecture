import { NextResponse, type NextRequest } from 'next/server';

import { getAllowedOrigins, getBffSessionCookieName } from './lib/bff-config';
import {
  clearSessionCookie,
  readSessionCookie,
  replaceSessionCookie,
  setSessionCookie,
} from './app/api/_lib/session-cookie';
import { resolveSession } from './app/api/_lib/session-refresh';

/**
 * API boundary: handles approved CORS preflight requests, rejects requests
 * without credentials and keeps the BFF session alive. When the Keycloak
 * access token is about to expire it is renewed here, once, and the refreshed
 * cookie is both forwarded to the route and returned to the browser. Token
 * signature and RBAC checks remain in each route through auth-guard.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const corsHeaders = resolveCorsHeaders(origin);

  if (origin && !corsHeaders) {
    return NextResponse.json(
      { error: 'Origin is not allowed' },
      { status: 403 },
    );
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders ?? undefined,
    });
  }

  if (isPublicAuthenticationRoute(request)) {
    return NextResponse.next({ headers: corsHeaders ?? undefined });
  }

  // Server-to-server callers bring their own token; no session handling.
  if (hasBearerHeader(request.headers.get('authorization'))) {
    return NextResponse.next({ headers: corsHeaders ?? undefined });
  }

  const cookieHeader = request.headers.get('cookie');
  if (!hasSessionCookie(cookieHeader)) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401, headers: corsHeaders ?? undefined },
    );
  }

  const resolution = await resolveSession(readSessionCookie(cookieHeader), {
    touch: isActivityHeartbeat(request),
  });

  if (resolution.status === 'invalid') {
    const response = NextResponse.json(
      { error: 'Session expired' },
      { status: 401, headers: corsHeaders ?? undefined },
    );
    clearSessionCookie(response);
    return response;
  }
  if (resolution.status === 'unavailable') {
    return NextResponse.json(
      { error: 'Authentication service is unavailable' },
      { status: 503, headers: corsHeaders ?? undefined },
    );
  }

  if (!resolution.sealed) {
    return NextResponse.next({ headers: corsHeaders ?? undefined });
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(
    'cookie',
    replaceSessionCookie(cookieHeader, resolution.sealed.value),
  );
  const response = NextResponse.next({
    request: { headers: forwardedHeaders },
    headers: corsHeaders ?? undefined,
  });
  setSessionCookie(response, resolution.sealed);
  return response;
}

/** Only an explicit portal heartbeat counts as user activity. */
function isActivityHeartbeat(request: NextRequest): boolean {
  return (
    request.method === 'POST' &&
    request.nextUrl.pathname === '/api/auth/refresh'
  );
}

/** OAuth redirects start before a BFF session exists. Keep this allowlist narrow. */
function isPublicAuthenticationRoute(request: NextRequest): boolean {
  return (
    request.method === 'GET' &&
    (request.nextUrl.pathname === '/api/health' ||
      request.nextUrl.pathname === '/api/auth/login' ||
      request.nextUrl.pathname === '/api/auth/callback' ||
      request.nextUrl.pathname === '/api/auth/logout')
  );
}

export const config = {
  matcher: ['/api/:path*'],
};

function hasBearerHeader(header: string | null): boolean {
  return /^Bearer\s+\S+$/i.test(header ?? '');
}

function hasSessionCookie(cookieHeader: string | null): boolean {
  const cookieName = getBffSessionCookieName();
  return (
    cookieHeader
      ?.split(';')
      .some((part) => part.trim().startsWith(`${cookieName}=`)) ?? false
  );
}

function resolveCorsHeaders(origin: string | null): Headers | null {
  if (!origin) {
    return null;
  }

  if (!getAllowedOrigins().includes(origin)) {
    return null;
  }

  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  });
}
