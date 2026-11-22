import { getEtlStatus } from '@dss-monorepo/dw-control-connector/server';

import { withDwControl } from '../../_lib/dw-control-route';

export const runtime = 'nodejs';

/** Whether an ETL is running right now; polled by the admin-portal header indicator. */
export function GET(request: Request): Promise<Response> {
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) => getEtlStatus(config, signal),
  );
}
