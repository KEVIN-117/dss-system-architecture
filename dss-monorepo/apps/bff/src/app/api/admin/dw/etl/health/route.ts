import { getLoadManagerHealth } from '@dss-monorepo/dw-control-connector/server';

import { withDwControl } from '../../_lib/dw-control-route';

export const runtime = 'nodejs';

/** Load Manager status: Hop Server reachability, monitor and scheduler switches, DSA operating hours. */
export function GET(request: Request): Promise<Response> {
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) => getLoadManagerHealth(config, signal),
  );
}
