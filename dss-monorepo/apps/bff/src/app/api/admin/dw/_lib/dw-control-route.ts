import {
  DwControlClientError,
  type DwControlPermission,
  type DwControlServiceConfig,
} from '@dss-monorepo/dw-control-connector/server';
import { NextResponse } from 'next/server';

import {
  BffConfigurationError,
  getDwControlServiceConfig,
} from '../../../../../lib/bff-config';
import { withCors } from '../../../../../lib/cors';
import {
  authenticateRequest,
  requireClientRoles,
  type AuthenticatedRequest,
} from '../../../_lib/auth-guard';

const DW_CONTROL_CLIENT_ID = 'dw-control-service';

export async function withDwControl<T>(
  request: Request,
  permission: DwControlPermission,
  action: (
    config: DwControlServiceConfig,
    authentication: AuthenticatedRequest,
    signal: AbortSignal,
  ) => Promise<T>,
  successStatus = 200,
): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated)
    return withCors(request, authentication.response);

  const forbidden = requireClientRoles(
    authentication.value,
    DW_CONTROL_CLIENT_ID,
    [permission],
  );
  if (forbidden) return withCors(request, forbidden);

  try {
    const service = getDwControlServiceConfig();
    const result = await action(
      { ...service, accessToken: authentication.value.token },
      authentication.value,
      request.signal,
    );
    return withCors(
      request,
      NextResponse.json(result, {
        status: successStatus,
        headers: { 'Cache-Control': 'no-store' },
      }),
    );
  } catch (error) {
    return withCors(request, mapDwControlError(error));
  }
}

export function mapDwControlError(error: unknown): NextResponse {
  if (error instanceof BffConfigurationError) {
    console.error(
      '[bff-dw-control] invalid service configuration',
      error.message,
    );
    return NextResponse.json(
      {
        error: 'DW control integration is unavailable',
        code: 'DW_CONTROL_CONFIGURATION_ERROR',
      },
      { status: 500 },
    );
  }
  if (error instanceof DwControlClientError) {
    const status =
      error.status === 504
        ? 504
        : error.status === 401 ||
            error.status === 403 ||
            error.status === 404 ||
            error.status === 409 ||
            error.status === 429
          ? error.status
          : error.status === 400 || error.status === 422
            ? error.status
            : 502;
    const message =
      status === 401
        ? 'DW control authorization was rejected'
        : status === 403
          ? 'Insufficient permissions'
          : status === 404
            ? 'DW resource not found'
            : status === 409
              ? 'DW operation conflicts with the current state'
              : status === 400 || status === 422
                ? 'Invalid DW control request'
                : status === 429
                  ? 'DW control service is rate limiting requests'
                  : status === 504
                    ? 'DW control service timed out'
                    : 'DW control service is unavailable';
    return NextResponse.json({ error: message, code: error.code }, { status });
  }
  console.error(
    '[bff-dw-control] unexpected dw-control-service failure',
    error instanceof Error ? error.name : 'unknown',
  );
  return NextResponse.json(
    {
      error: 'DW control service is unavailable',
      code: 'DW_CONTROL_UNAVAILABLE',
    },
    { status: 502 },
  );
}

export function parsePositiveId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function invalidDwRequest(
  message = 'Invalid DW control request',
): Response {
  return NextResponse.json(
    { error: message, code: 'DW_CONTROL_INVALID_REQUEST' },
    { status: 400 },
  );
}
