import { NextResponse } from 'next/server';

import { authenticateRequest } from '../../_lib/auth-guard';
import { withCors } from '../../../../lib/cors';

export const runtime = 'nodejs';

/**
 * GET /api/auth/me
 *
 * Returns the local profile together with the portal roles and the permissions
 * (`dss-permissions`, IAM-014) of a verified Keycloak token. Browser calls use the encrypted BFF session cookie; the
 * bearer form remains available for trusted server-to-server callers.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) {
    return withCors(request, authentication.response);
  }

  return withCors(
    request,
    NextResponse.json(
      {
        user: authentication.value.user,
        roles: authentication.value.roles,
        permissions: [...authentication.value.permissions],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  );
}
