import {
  createEtlSchedule,
  listEtlSchedules,
  type CreateScheduleInput,
} from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  readJsonBody,
  withDwControl,
} from '../../_lib/dw-control-route';
import { isRecord, onlyKeys } from '../_lib/etl-request';

export const runtime = 'nodejs';

export function GET(request: Request): Promise<Response> {
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) => listEtlSchedules(config, signal),
  );
}

/**
 * Creates a schedule (201). dw-control-service answers 400 with a `detail` when the cron falls inside the DSA
 * operating hours, is invalid or fires too often; the BFF forwards that detail.
 */
export async function POST(request: Request): Promise<Response> {
  const input = parseSchedule(await readJsonBody(request));
  if (!input) return invalidDwRequest('Invalid ETL schedule request');
  return withDwControl(
    request,
    'DW_ETL_SCHEDULE_MANAGE',
    (config, _authentication, signal) => createEtlSchedule(config, input, signal),
    201,
  );
}

function parseSchedule(body: unknown): CreateScheduleInput | null {
  if (
    !isRecord(body) ||
    !onlyKeys(body, ['processCode', 'name', 'cronExpression', 'timezone', 'enabled']) ||
    typeof body.processCode !== 'string' ||
    typeof body.name !== 'string' ||
    typeof body.cronExpression !== 'string' ||
    (body.timezone !== undefined && typeof body.timezone !== 'string') ||
    (body.enabled !== undefined && typeof body.enabled !== 'boolean')
  )
    return null;
  return {
    processCode: body.processCode,
    name: body.name,
    cronExpression: body.cronExpression,
    ...(body.timezone === undefined ? {} : { timezone: body.timezone as string }),
    ...(body.enabled === undefined ? {} : { enabled: body.enabled as boolean }),
  };
}
