import {
  AuthServiceClientError,
  getAcademicCatalog,
} from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import {
  BffConfigurationError,
  getBffAuthConfig,
} from '../../../../lib/bff-config';
import { withCors } from '../../../../lib/cors';
import { authenticateRequest, requireRoles } from '../../_lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/academic-catalog — active catalog from Auth Service. */
export async function GET(request: Request): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) {
    return withCors(request, authentication.response);
  }

  const forbidden = requireRoles(authentication.value, ['SUPERADMIN']);
  if (forbidden) return withCors(request, forbidden);

  try {
    const config = getBffAuthConfig();
    const catalog = await getAcademicCatalog(
      config.authServiceUrl,
      authentication.value.token,
      request.signal,
    );
    return withCors(
      request,
      NextResponse.json(catalog, {
        headers: { 'Cache-Control': 'no-store' },
      }),
    );
  } catch (error) {
    if (error instanceof BffConfigurationError) {
      console.error('[bff-admin] invalid auth-service configuration', error.message);
      return withCors(
        request,
        NextResponse.json(
          { error: 'Admin integration is unavailable' },
          { status: 500 },
        ),
      );
    }
    if (error instanceof AuthServiceClientError) {
      const status = error.status === 504
        ? 504
        : error.status >= 400 && error.status < 500
          ? error.status
          : 502;
      return withCors(
        request,
        NextResponse.json(
            { error: 'Unable to load academic catalog', upstreamStatus: error.status },
          { status },
        ),
      );
    }
    console.error('[bff-admin] auth-service academic catalog request failed', error);
    return withCors(
      request,
      NextResponse.json(
        { error: 'Auth service is unavailable' },
        { status: 502 },
      ),
    );
  }
}
