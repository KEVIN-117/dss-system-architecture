import { getEtlLaunchLogs } from '@dss-monorepo/dw-control-connector/server';

import { invalidDwRequest, withDwControl } from '../../../../_lib/dw-control-route';
import { isUuid } from '../../../_lib/etl-request';

export const runtime = 'nodejs';

/** Sanitized tail of the Hop log of a launch (credentials masked by dw-control-service). */
export async function GET(
  request: Request,
  context: { params: Promise<{ launchId: string }> },
): Promise<Response> {
  const { launchId } = await context.params;
  if (!isUuid(launchId)) return invalidDwRequest('Invalid launch ID');
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) => getEtlLaunchLogs(config, launchId, signal),
  );
}
