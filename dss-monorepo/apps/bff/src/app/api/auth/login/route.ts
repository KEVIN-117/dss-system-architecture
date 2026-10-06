import { createAuthorizationUrl } from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import { getAllowedOrigins, getBffAuthConfig } from '../../../../lib/bff-config';
import {
  createOAuthTransaction,
  getOAuthTransactionCookieName,
  oauthTransactionCookieOptions,
  safeReturnTo,
  sealOAuthTransaction,
} from '../../_lib/oauth-transaction';

export const runtime = 'nodejs';

/** Starts the server-owned Authorization Code + PKCE flow. */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const config = getBffAuthConfig();
  const action = url.searchParams.get('action') === 'register' ? 'register' : undefined;
  const transaction = await createOAuthTransaction(
    safeReturnTo(
      url.searchParams.get('returnTo'),
      config.defaultPostLoginRedirectUri,
      getAllowedOrigins(),
    ),
    action,
  );
  const authorizationUrl = createAuthorizationUrl(config.oidc, transaction);
  const response = NextResponse.redirect(authorizationUrl, 302);
  console.log('====================');
  console.log('Authorization URL: ', authorizationUrl);
  console.log('====================');

  console.log('====================');
  console.log('Transaction: ', transaction);
  console.log('====================');

  console.log('====================');
  console.log('Response: ', response);
  console.log('====================');

  response.cookies.set({
    name: getOAuthTransactionCookieName(),
    value: await sealOAuthTransaction(transaction),
    ...oauthTransactionCookieOptions(),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
