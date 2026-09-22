import { NextResponse, type NextRequest } from 'next/server';

import { getAllowedOrigins } from './lib/bff-config';

/**
 * Cheap API boundary: it handles approved CORS preflight requests and rejects
 * missing bearer headers. Token signature and RBAC checks remain in each route
 * through auth-guard, where the Node-compatible connector can be used.
 */
export function proxy(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const corsHeaders = resolveCorsHeaders(origin);

  if (origin && !corsHeaders) {
    return NextResponse.json({ error: 'Origin is not allowed' }, { status: 403 });
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders ?? undefined });
  }

  if (!hasBearerHeader(request.headers.get('authorization'))) {
    return NextResponse.json(
      { error: 'Authorization header required' },
      { status: 401, headers: corsHeaders ?? undefined },
    );
  }

  return NextResponse.next({ headers: corsHeaders ?? undefined });
}

export const config = {
  matcher: ['/api/:path*'],
};

function hasBearerHeader(header: string | null): boolean {
  return /^Bearer\s+\S+$/i.test(header ?? '');
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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    Vary: 'Origin',
  });
}
