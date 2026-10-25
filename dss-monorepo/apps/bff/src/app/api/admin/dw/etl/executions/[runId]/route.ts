import { getEtlExecution } from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  withDwControl,
} from '../../../_lib/dw-control-route';

export const runtime = 'nodejs';

export function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  return context.params.then(({ runId }) => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        runId,
      )
    ) {
      return invalidDwRequest('Invalid ETL execution ID');
    }
    return withDwControl(
      request,
      'DW_ETL_MONITOR_READ',
      (config, _authentication, signal) =>
        getEtlExecution(config, runId, signal),
    );
  });
}
