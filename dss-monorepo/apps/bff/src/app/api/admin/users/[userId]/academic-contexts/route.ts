import {
  AuthServiceClientError,
  isAcademicContextAssignmentRequest,
  replaceUserAcademicContexts,
} from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import {
  BffConfigurationError,
  getBffAuthConfig,
} from '../../../../../../lib/bff-config';
import { withCors } from '../../../../../../lib/cors';
import { authenticateRequest, requireRoles } from '../../../../_lib/auth-guard';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * PUT /api/admin/users/:userId/academic-contexts
 *
 * Exposes the auth-service administrative operation to SUPERADMIN users only.
 * The verified user's access token is forwarded so auth-service applies its
 * own ROLE_SUPERADMIN authorization as a second boundary.
 */
export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) {
    return withCors(request, authentication.response);
  }

  const forbidden = requireRoles(authentication.value, ['SUPERADMIN']);
  if (forbidden) {
    return withCors(request, forbidden);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(
      request,
      NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 },
      ),
    );
  }

  if (!isAcademicContextAssignmentRequest(body)) {
    return withCors(
      request,
      NextResponse.json(
        { error: 'Invalid academic context assignment request' },
        { status: 400 },
      ),
    );
  }

  const { userId } = await context.params;
  try {
    const config = getBffAuthConfig();
    const result = await replaceUserAcademicContexts(
      config.authServiceUrl,
      authentication.value.token,
      userId,
      body,
      request.signal,
    );

    return withCors(
      request,
      NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store' },
      }),
    );
  } catch (error) {
    if (error instanceof BffConfigurationError) {
      console.error(
        '[bff-admin] invalid auth-service configuration',
        error.message,
      );
      return withCors(
        request,
        NextResponse.json(
          { error: 'Admin integration is unavailable' },
          { status: 500 },
        ),
      );
    }

    if (error instanceof AuthServiceClientError) {
      const status =
        error.status === 504
          ? 504
          : error.status >= 400 && error.status < 500
            ? error.status
            : 502;
      return withCors(
        request,
        NextResponse.json(
          {
            error: 'Unable to update academic contexts',
            upstreamStatus: error.status,
          },
          { status },
        ),
      );
    }

    console.error(
      '[bff-admin] auth-service academic context update failed',
      error,
    );
    return withCors(
      request,
      NextResponse.json(
        { error: 'Auth service is unavailable' },
        { status: 502 },
      ),
    );
  }
}
