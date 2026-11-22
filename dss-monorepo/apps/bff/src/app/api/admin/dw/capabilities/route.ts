import { NextResponse } from 'next/server';

import { withCors } from '../../../../../lib/cors';
import { authenticateRequest } from '../../../_lib/auth-guard';
import { DW_PERMISSIONS } from '../_lib/dw-control-route';

export const runtime = 'nodejs';

/**
 * Exposes only boolean capabilities derived from the `dw:*` permissions of the token, the same ones
 * dw-control-service checks (IAM-011). Before IAM-019 this read the retired `DW_*` client roles.
 */
export async function GET(request: Request): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated)
    return withCors(request, authentication.response);

  const permissions = authentication.value.permissions;
  return withCors(
    request,
    NextResponse.json(
      {
        canReadClosures: permissions.includes(DW_PERMISSIONS.DW_CLOSURE_READ),
        canManageClosures: permissions.includes(DW_PERMISSIONS.DW_CLOSURE_MANAGE),
        canReadEtlExecutions: permissions.includes(DW_PERMISSIONS.DW_ETL_MONITOR_READ),
        // Load Manager (LM-006): launch/stop and schedule administration.
        canExecuteEtl: permissions.includes(DW_PERMISSIONS.DW_ETL_EXECUTE),
        canManageEtlSchedules: permissions.includes(DW_PERMISSIONS.DW_ETL_SCHEDULE_MANAGE),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  );
}
