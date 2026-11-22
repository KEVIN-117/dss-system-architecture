import {
  ETL_LAUNCH_STATUSES,
  ETL_LAUNCH_TRIGGERS,
  launchEtlProcess,
  listEtlLaunches,
  type EtlLaunchStatus,
  type EtlLaunchTrigger,
  type LaunchEtlInput,
  type LaunchListQuery,
} from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  readJsonBody,
  withDwControl,
} from '../../_lib/dw-control-route';
import {
  integerValue,
  isRecord,
  isUuid,
  onlyKeys,
  singleValuedQuery,
} from '../_lib/etl-request';

export const runtime = 'nodejs';

/** Launch history, newest first. `scheduleId` gives the fire history of a schedule. */
export function GET(request: Request): Promise<Response> {
  const query = parseQuery(new URL(request.url).searchParams);
  if (!query) return Promise.resolve(invalidDwRequest('Invalid ETL launch filters'));
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) => listEtlLaunches(config, query, signal),
  );
}

/** Registers a launch and submits it to Hop Server (201). 409 when the process is already running. */
export async function POST(request: Request): Promise<Response> {
  const input = parseLaunch(await readJsonBody(request));
  if (!input) return invalidDwRequest('Invalid ETL launch request');
  return withDwControl(
    request,
    'DW_ETL_EXECUTE',
    (config, _authentication, signal) => launchEtlProcess(config, input, signal),
    201,
  );
}

function parseQuery(params: URLSearchParams): LaunchListQuery | null {
  const values = singleValuedQuery(params, [
    'processCode',
    'status',
    'trigger',
    'scheduleId',
    'page',
    'size',
  ]);
  if (!values) return null;
  const processCode = values.get('processCode');
  const status = values.get('status');
  const trigger = values.get('trigger');
  const scheduleId = integerValue(values.get('scheduleId'));
  const page = integerValue(values.get('page'));
  const size = integerValue(values.get('size'));
  if (
    scheduleId === null ||
    page === null ||
    size === null ||
    (processCode !== undefined && !/^[A-Z][A-Z0-9_]{1,31}$/.test(processCode)) ||
    (status !== undefined && !(ETL_LAUNCH_STATUSES as readonly string[]).includes(status)) ||
    (trigger !== undefined && !(ETL_LAUNCH_TRIGGERS as readonly string[]).includes(trigger))
  )
    return null;
  return {
    ...(processCode === undefined ? {} : { processCode }),
    ...(status === undefined ? {} : { status: status as EtlLaunchStatus }),
    ...(trigger === undefined ? {} : { trigger: trigger as EtlLaunchTrigger }),
    ...(scheduleId === undefined ? {} : { scheduleId }),
    ...(page === undefined ? {} : { page }),
    ...(size === undefined ? {} : { size }),
  };
}

function parseLaunch(body: unknown): LaunchEtlInput | null {
  if (
    !isRecord(body) ||
    !onlyKeys(body, ['processCode', 'executionKind', 'closureId', 'retryOfRunId', 'runId']) ||
    typeof body.processCode !== 'string' ||
    (body.executionKind !== undefined &&
      body.executionKind !== 'CIERRE_ACADEMICO' &&
      body.executionKind !== 'REPROCESO') ||
    (body.closureId !== undefined &&
      !(typeof body.closureId === 'number' && Number.isSafeInteger(body.closureId) && body.closureId > 0)) ||
    (body.retryOfRunId !== undefined && !isUuid(body.retryOfRunId)) ||
    (body.runId !== undefined && !isUuid(body.runId))
  )
    return null;
  return {
    processCode: body.processCode,
    ...(body.executionKind === undefined
      ? {}
      : { executionKind: body.executionKind as 'CIERRE_ACADEMICO' | 'REPROCESO' }),
    ...(body.closureId === undefined ? {} : { closureId: body.closureId as number }),
    ...(body.retryOfRunId === undefined ? {} : { retryOfRunId: body.retryOfRunId as string }),
    ...(body.runId === undefined ? {} : { runId: body.runId as string }),
  };
}
