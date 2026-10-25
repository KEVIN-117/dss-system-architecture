import { NextResponse } from 'next/server';

import { withCors } from '../../../../../lib/cors';
import { authenticateRequest } from '../../../_lib/auth-guard';

export const runtime = 'nodejs';

/** Exposes only boolean capabilities; service-client roles stay server-side. */
export async function GET(request: Request): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated)
    return withCors(request, authentication.response);

  const roles = authentication.value.clientRoles['dw-control-service'] ?? [];
  return withCors(
    request,
    NextResponse.json(
      {
        canReadClosures: roles.includes('DW_CLOSURE_READ'),
        canManageClosures: roles.includes('DW_CLOSURE_MANAGE'),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  );
}
