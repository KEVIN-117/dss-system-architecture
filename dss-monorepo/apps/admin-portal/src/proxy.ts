import { NextResponse } from 'next/server';

export function proxy() {
  // The BFF session cookie is host-only and cannot be inspected from a
  // separate dashboard origin. API authorization is enforced by the BFF;
  // the client AuthProvider controls the presentation state.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|silent-check-sso.html).*)'],
};
