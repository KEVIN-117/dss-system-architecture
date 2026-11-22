import { listEtlProcesses } from '@dss-monorepo/dw-control-connector/server';

import { withDwControl } from '../../_lib/dw-control-route';

export const runtime = 'nodejs';

/** Catalog of processes the Load Manager can launch or schedule. */
export function GET(request: Request): Promise<Response> {
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) => listEtlProcesses(config, signal),
  );
}
