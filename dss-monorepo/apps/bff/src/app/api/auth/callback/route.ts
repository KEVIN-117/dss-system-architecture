import {
  exchangeAuthorizationCode,
  fetchUserProfile,
  verifyKeycloakIdToken,
  verifyKeycloakJwt,
} from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import { getBffAuthConfig, getBffSessionConfig } from '../../../../lib/bff-config';
import {
  getOAuthTransactionCookieName,
  oauthTransactionCookieOptions,
  unsealOAuthTransaction,
} from '../../_lib/oauth-transaction';
import { sealSession } from '../../_lib/session-cookie';

export const runtime = 'nodejs';

/** Completes a matching Authorization Code + PKCE transaction and establishes the BFF session. */
export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const config = getBffAuthConfig();
  const transaction = await readTransaction(request.headers.get('cookie'));
  if (!transaction) {
    return authenticationFailure(
      new URL(config.defaultPostLoginRedirectUri).origin,
      config.defaultPostLoginRedirectUri,
    );
  }

  const providerError = requestUrl.searchParams.get('error');
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  if (providerError || !code || state !== transaction.state) {
    return authenticationFailure(new URL(transaction.returnTo).origin, transaction.returnTo);
  }

  try {
    const tokens = await exchangeAuthorizationCode(config.oidc, {
      code,
      codeVerifier: transaction.codeVerifier,
    });
    await verifyKeycloakIdToken(tokens.idToken, {
      keycloakUrl: config.oidc.keycloakUrl,
      realm: config.oidc.realm,
      audience: config.oidc.clientId,
      nonce: transaction.nonce,
    });
    await verifyKeycloakJwt(tokens.accessToken, config.keycloak);
    const profile = await fetchUserProfile(config.authServiceUrl, tokens.accessToken);
    if (!profile.isActive) {
      return authenticationFailure(new URL(transaction.returnTo).origin, transaction.returnTo);
    }

    const session = await sealSession({
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
    });
    const response = NextResponse.redirect(new URL(transaction.returnTo, requestUrl.origin), 303);
    const sessionConfig = getBffSessionConfig();
    response.cookies.set({
      name: sessionConfig.cookieName,
      value: session.value,
      httpOnly: true,
      secure: sessionConfig.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: session.maxAge,
    });
    response.cookies.set({
      name: getOAuthTransactionCookieName(),
      value: '',
      ...oauthTransactionCookieOptions(0),
    });
    response.headers.set('Cache-Control', 'no-store');

    // Profile lookup completed before redirect, so an inactive or missing user
    // cannot obtain a BFF session. Roles remain server-authoritative.
    return response;
  } catch {
    return authenticationFailure(new URL(transaction.returnTo).origin, transaction.returnTo);
  }
}

async function readTransaction(cookieHeader: string | null) {
  const name = getOAuthTransactionCookieName();
  const value = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value ? unsealOAuthTransaction(decodeURIComponent(value)) : null;
}

function authenticationFailure(origin: string, returnTo: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/login?error=authentication_failed&returnTo=${encodeURIComponent(returnTo)}`, origin),
    303,
  );
  response.cookies.set({
    name: getOAuthTransactionCookieName(),
    value: '',
    ...oauthTransactionCookieOptions(0),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
