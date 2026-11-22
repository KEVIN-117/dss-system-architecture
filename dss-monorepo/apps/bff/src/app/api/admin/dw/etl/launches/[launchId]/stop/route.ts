import { stopEtlLaunch } from '@dss-monorepo/dw-control-connector/server';

import { invalidDwRequest, withDwControl } from '../../../../_lib/dw-control-route';
import { isUuid } from '../../../_lib/etl-request';

export const runtime = 'nodejs';

/** Asks Hop Server to stop a launch (202); it becomes STOPPED when the monitor observes it. */
export async function POST(
  request: Request,
  context: { params: Promise<{ launchId: string }> },
): Promise<Response> {
  const { launchId } = await context.params;
  if (!isUuid(launchId)) return invalidDwRequest('Invalid launch ID');
  return withDwControl(
    request,
    'DW_ETL_EXECUTE',
    (config, _authentication, signal) => stopEtlLaunch(config, launchId, signal),
    202,
  );
}
