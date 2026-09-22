import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('dss_authenticated');

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
  const isPublicAsset =
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon') ||
    request.nextUrl.pathname === '/silent-check-sso.html';

  if (isAuthRoute || isPublicAsset) return NextResponse.next();
  if (!hasSession) return NextResponse.redirect(new URL('/auth/callback', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|silent-check-sso.html).*)'],
};