import { createLogoutUrl } from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import { getBffAuthConfig } from '../../../../lib/bff-config';
import {
  clearSessionCookie,
  readSessionCookie,
  unsealSessionTokens,
} from '../../_lib/session-cookie';

export const runtime = 'nodejs';

/** Clears the local session and asks Keycloak to close its SSO session when possible. */
export async function GET(request: Request): Promise<NextResponse> {
  const config = getBffAuthConfig();
  const cookie = readSessionCookie(request.headers.get('cookie'));
  // An idle-expired session still carries a usable logout hint, so read it
  // without enforcing expiry: closing the Keycloak SSO session matters most here.
  const session = cookie ? await unsealSessionTokens(cookie, 0) : null;
  const redirect = session?.idToken
    ? createLogoutUrl(
        config.oidc,
        session.idToken,
        config.oidc.postLogoutRedirectUri,
      )
    : new URL(config.oidc.postLogoutRedirectUri);
  const response = NextResponse.redirect(redirect, 303);
  clearSessionCookie(response);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
