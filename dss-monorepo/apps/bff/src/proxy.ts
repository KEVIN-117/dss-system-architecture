import { NextResponse, type NextRequest } from 'next/server';

import { getAllowedOrigins, getBffSessionCookieName } from './lib/bff-config';

/**
 * Cheap API boundary: it handles approved CORS preflight requests and rejects
 * requests without a bearer token or BFF session cookie. Token signature and
 * RBAC checks remain in each route through auth-guard.
 */
export function proxy(request: NextRequest): NextResponse {
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

  if (
    !isPublicAuthenticationRoute(request) &&
    !hasBearerHeader(request.headers.get('authorization')) &&
    !hasSessionCookie(request.headers.get('cookie'))
  ) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401, headers: corsHeaders ?? undefined },
    );
  }

  return NextResponse.next({ headers: corsHeaders ?? undefined });
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
