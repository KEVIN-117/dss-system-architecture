import {
  deleteEtlSchedule,
  getEtlSchedule,
  updateEtlSchedule,
} from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  parsePositiveId,
  readJsonBody,
  withDwControl,
} from '../../../_lib/dw-control-route';
import { integerValue, isRecord, onlyKeys } from '../../_lib/etl-request';

export const runtime = 'nodejs';

type Context = { params: Promise<{ scheduleId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const scheduleId = parsePositiveId((await context.params).scheduleId);
  if (scheduleId === null) return invalidDwRequest('Invalid schedule ID');
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) => getEtlSchedule(config, scheduleId, signal),
  );
}

/** Edits name, cron and zone; `rowVersion` is the version the portal loaded (409 when stale). */
export async function PUT(request: Request, context: Context): Promise<Response> {
  const scheduleId = parsePositiveId((await context.params).scheduleId);
  const body = await readJsonBody(request);
  if (
    scheduleId === null ||
    !isRecord(body) ||
    !onlyKeys(body, ['name', 'cronExpression', 'timezone', 'rowVersion']) ||
    typeof body.name !== 'string' ||
    typeof body.cronExpression !== 'string' ||
    (body.timezone !== undefined && typeof body.timezone !== 'string') ||
    typeof body.rowVersion !== 'number'
  )
    return invalidDwRequest('Invalid ETL schedule request');
  const input = {
    name: body.name,
    cronExpression: body.cronExpression,
    ...(body.timezone === undefined ? {} : { timezone: body.timezone as string }),
    rowVersion: body.rowVersion,
  };
  return withDwControl(
    request,
    'DW_ETL_SCHEDULE_MANAGE',
    (config, _authentication, signal) => updateEtlSchedule(config, scheduleId, input, signal),
  );
}

/** Soft delete (204); launches fired by the schedule keep pointing at it. */
export async function DELETE(request: Request, context: Context): Promise<Response> {
  const scheduleId = parsePositiveId((await context.params).scheduleId);
  const params = new URL(request.url).searchParams;
  const rowVersion = integerValue(params.get('rowVersion') ?? undefined);
  if (scheduleId === null || rowVersion === null || rowVersion === undefined || params.getAll('rowVersion').length > 1)
    return invalidDwRequest('Invalid ETL schedule request');
  return withDwControl(
    request,
    'DW_ETL_SCHEDULE_MANAGE',
    (config, _authentication, signal) => deleteEtlSchedule(config, scheduleId, rowVersion, signal),
    204,
  );
}
