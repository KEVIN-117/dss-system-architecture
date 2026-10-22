import {
  AuthServiceClientError,
  getAdminUser,
} from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import { BffConfigurationError, getBffAuthConfig } from '../../../../../lib/bff-config';
import { withCors } from '../../../../../lib/cors';
import { authenticateRequest, requireRoles } from '../../../_lib/auth-guard';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/** GET /api/admin/users/:userId — safe local user detail for SUPERADMIN. */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) return withCors(request, authentication.response);

  const forbidden = requireRoles(authentication.value, ['SUPERADMIN']);
  if (forbidden) return withCors(request, forbidden);

  const { userId } = await context.params;
  try {
    const config = getBffAuthConfig();
    const user = await getAdminUser(config.authServiceUrl, authentication.value.token, userId, request.signal);
    return withCors(request, NextResponse.json(user, { headers: { 'Cache-Control': 'no-store' } }));
  } catch (error) {
    if (error instanceof BffConfigurationError) {
      console.error('[bff-admin] invalid auth-service configuration', error.message);
      return withCors(request, NextResponse.json({ error: 'Admin integration is unavailable' }, { status: 500 }));
    }
    if (error instanceof AuthServiceClientError) {
      const status = error.status === 504 ? 504 : error.status >= 400 && error.status < 500 ? error.status : 502;
      return withCors(request, NextResponse.json({ error: 'Unable to load user details', upstreamStatus: error.status }, { status }));
    }
    console.error('[bff-admin] auth-service user detail request failed', error);
    return withCors(request, NextResponse.json({ error: 'Auth service is unavailable' }, { status: 502 }));
  }
}
