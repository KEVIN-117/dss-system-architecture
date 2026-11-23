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
  requirePermissions,
  type AuthenticatedRequest,
} from '../../../_lib/auth-guard';

/**
 * dss-permissions name of each DW capability (IAM-011/IAM-014). The keys are the connector's capability
 * names, not Keycloak roles: the old `DW_*` client roles were retired in IAM-019.
 */
export const DW_PERMISSIONS: Record<DwControlPermission, string> = {
  DW_CLOSURE_READ: 'dw:closure:read',
  DW_CLOSURE_MANAGE: 'dw:closure:manage',
  DW_ETL_MONITOR_READ: 'dw:etl-monitor:read',
  // Load Manager (LM-005/LM-006).
  DW_ETL_EXECUTE: 'dw:etl:execute',
  DW_ETL_SCHEDULE_MANAGE: 'dw:etl-schedule:manage',
};

/** The `dw:*` permission of the token, the same rule dw-control-service enforces. */
export function requireDwPermission(
  authentication: AuthenticatedRequest,
  permission: DwControlPermission,
): NextResponse | null {
  return requirePermissions(authentication, [DW_PERMISSIONS[permission]]);
}

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

  const forbidden = requireDwPermission(authentication.value, permission);
  if (forbidden) return withCors(request, forbidden);

  try {
    const service = getDwControlServiceConfig();
    const result = await action(
      { ...service, accessToken: authentication.value.token },
      authentication.value,
      request.signal,
    );
    if (successStatus === 204)
      return withCors(
        request,
        new NextResponse(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        }),
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
    // LM-006: Hop Server outages and rejections keep their own code so the portal can explain them.
    if (error.code === 'HOP_UNAVAILABLE')
      return NextResponse.json(
        { error: 'Hop Server is unavailable', code: error.code },
        { status: 503 },
      );
    if (error.code === 'HOP_REJECTED')
      return NextResponse.json(
        { error: 'Hop Server rejected the request', code: error.code },
        { status: 502 },
      );
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
    // `detail` is the reason dw-control-service gave for a 400/404/409/422 (for example a schedule inside the DSA
    // operating hours); the connector only keeps it after screening it for internal data.
    return NextResponse.json(
      {
        error: message,
        code: error.code,
        ...(error.detail && (status === 400 || status === 404 || status === 409 || status === 422)
          ? { detail: error.detail }
          : {}),
      },
      { status },
    );
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
