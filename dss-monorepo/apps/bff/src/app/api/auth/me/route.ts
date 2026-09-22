import { NextResponse } from 'next/server';

import { authenticateRequest } from '../../_lib/auth-guard';

/**
 * GET /api/auth/me
 *
 * Returns the local profile together with DSS roles extracted from a verified
 * Keycloak token. Dashboards must use this BFF endpoint instead of calling
 * auth-service directly.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) {
    return authentication.response;
  }

  return NextResponse.json({
    user: authentication.value.user,
    roles: authentication.value.roles,
  });
}
