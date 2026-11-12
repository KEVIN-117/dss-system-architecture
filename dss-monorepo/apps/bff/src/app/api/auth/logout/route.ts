import { createLogoutUrl } from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import {
  getBffAuthConfig,
  getBffSessionConfig,
} from '../../../../lib/bff-config';
import { unsealSessionTokens } from '../../_lib/session-cookie';

export const runtime = 'nodejs';

/** Clears the local session and asks Keycloak to close its SSO session when possible. */
export async function GET(request: Request): Promise<NextResponse> {
  const config = getBffAuthConfig();
  const session = await readSession(request.headers.get('cookie'));
  const redirect = session?.idToken
    ? createLogoutUrl(
        config.oidc,
        session.idToken,
        config.oidc.postLogoutRedirectUri,
      )
    : new URL(config.oidc.postLogoutRedirectUri);
  const response = NextResponse.redirect(redirect, 303);
  const sessionConfig = getBffSessionConfig();
  response.cookies.set({
    name: sessionConfig.cookieName,
    value: '',
    httpOnly: true,
    secure: sessionConfig.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function readSession(cookieHeader: string | null) {
  const name = getBffSessionConfig().cookieName;
  const value = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!value) return null;
  try {
    return await unsealSessionTokens(decodeURIComponent(value));
  } catch {
    return null;
  }
}
