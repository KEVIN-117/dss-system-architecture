import { setEtlScheduleEnabled } from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  parsePositiveId,
  readJsonBody,
  withDwControl,
} from '../../../_lib/dw-control-route';
import { isRecord, onlyKeys } from '../../_lib/etl-request';

/** Shared body of the enable and disable routes: `{ rowVersion }` of the schedule the portal loaded. */
export async function toggleSchedule(
  request: Request,
  context: { params: Promise<{ scheduleId: string }> },
  enabled: boolean,
): Promise<Response> {
  const scheduleId = parsePositiveId((await context.params).scheduleId);
  const body = await readJsonBody(request);
  if (
    scheduleId === null ||
    !isRecord(body) ||
    !onlyKeys(body, ['rowVersion']) ||
    typeof body.rowVersion !== 'number'
  )
    return invalidDwRequest('Invalid ETL schedule request');
  const rowVersion = body.rowVersion;
  return withDwControl(
    request,
    'DW_ETL_SCHEDULE_MANAGE',
    (config, _authentication, signal) =>
      setEtlScheduleEnabled(config, scheduleId, enabled, rowVersion, signal),
  );
}
