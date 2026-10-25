import {
  listEtlExecutions,
  type ExecutionKind,
  type ExecutionListQuery,
  type ExecutionStatus,
} from '@dss-monorepo/dw-control-connector/server';

import { invalidDwRequest, withDwControl } from '../../_lib/dw-control-route';

export const runtime = 'nodejs';

export function GET(request: Request): Promise<Response> {
  const query = parseQuery(new URL(request.url).searchParams);
  if (!query)
    return Promise.resolve(invalidDwRequest('Invalid ETL execution filters'));
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) =>
      listEtlExecutions(config, query, signal),
  );
}

function parseQuery(params: URLSearchParams): ExecutionListQuery | null {
  const allowed = new Set([
    'status',
    'executionKind',
    'gestion',
    'periodo',
    'closureId',
    'page',
    'size',
  ]);
  const keys = [...new Set(params.keys())];
  if (
    keys.some((key) => !allowed.has(key)) ||
    keys.some((key) => params.getAll(key).length > 1)
  )
    return null;
  const status = params.get('status');
  const executionKind = params.get('executionKind');
  const gestion = integerParam(params, 'gestion');
  const periodo = integerParam(params, 'periodo');
  const closureId = integerParam(params, 'closureId');
  const page = integerParam(params, 'page');
  const size = integerParam(params, 'size');
  if (
    gestion === null ||
    periodo === null ||
    closureId === null ||
    page === null ||
    size === null ||
    (status !== null &&
      ![
        'SOLICITADA',
        'EN_EJECUCION',
        'PUBLICANDO',
        'EXITOSA',
        'FALLIDA',
        'CANCELADA',
      ].includes(status)) ||
    (executionKind !== null &&
      !['HISTORICA', 'CIERRE_ACADEMICO', 'REPROCESO'].includes(executionKind))
  )
    return null;
  return {
    ...(status === null ? {} : { status: status as ExecutionStatus }),
    ...(executionKind === null
      ? {}
      : { executionKind: executionKind as ExecutionKind }),
    ...(gestion === undefined ? {} : { gestion }),
    ...(periodo === undefined ? {} : { periodo }),
    ...(closureId === undefined ? {} : { closureId }),
    ...(page === undefined ? {} : { page }),
    ...(size === undefined ? {} : { size }),
  };
}

function integerParam(
  params: URLSearchParams,
  key: string,
): number | null | undefined {
  const value = params.get(key);
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
