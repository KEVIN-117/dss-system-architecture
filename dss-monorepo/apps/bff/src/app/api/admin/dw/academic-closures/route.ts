import {
  createAcademicClosure,
  listAcademicClosures,
  type ClosureListQuery,
  type ClosureStatus,
} from '@dss-monorepo/dw-control-connector/server';

import {
  withDwControl,
  invalidDwRequest,
  readJsonBody,
} from '../_lib/dw-control-route';

export const runtime = 'nodejs';

export function GET(request: Request): Promise<Response> {
  const query = parseClosureQuery(new URL(request.url).searchParams);
  if (!query) return Promise.resolve(invalidDwRequest());
  return withDwControl(
    request,
    'DW_CLOSURE_READ',
    (config, _authentication, signal) =>
      listAcademicClosures(config, query, signal),
  );
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (
    !isRecord(body) ||
    !isAllowedKeys(body, ['gestion', 'periodo', 'reason']) ||
    !Number.isInteger(body.gestion) ||
    !Number.isInteger(body.periodo) ||
    typeof body.reason !== 'string'
  ) {
    return invalidDwRequest();
  }
  return withDwControl(
    request,
    'DW_CLOSURE_MANAGE',
    (config, _authentication, signal) =>
      createAcademicClosure(
        config,
        {
          gestion: body.gestion as number,
          periodo: body.periodo as number,
          reason: body.reason as string,
        },
        signal,
      ),
    201,
  );
}

function parseClosureQuery(params: URLSearchParams): ClosureListQuery | null {
  if (
    !onlyAllowedKeys(params, ['gestion', 'periodo', 'status', 'page', 'size'])
  )
    return null;
  const gestion = integerParam(params, 'gestion');
  const periodo = integerParam(params, 'periodo');
  const page = integerParam(params, 'page');
  const size = integerParam(params, 'size');
  const status = params.get('status');
  if (
    gestion === INVALID ||
    periodo === INVALID ||
    page === INVALID ||
    size === INVALID ||
    (status !== null &&
      !['PENDIENTE', 'CERRADO', 'REABIERTO', 'PROCESADO'].includes(status))
  )
    return null;
  return {
    ...(gestion === undefined ? {} : { gestion }),
    ...(periodo === undefined ? {} : { periodo }),
    ...(status === null ? {} : { status: status as ClosureStatus }),
    ...(page === undefined ? {} : { page }),
    ...(size === undefined ? {} : { size }),
  };
}

const INVALID = Symbol('invalid');
function integerParam(
  params: URLSearchParams,
  name: string,
): number | undefined | typeof INVALID {
  const values = params.getAll(name);
  if (values.length > 1) return INVALID;
  if (values.length === 0) return undefined;
  if (!/^\d+$/.test(values[0])) return INVALID;
  const value = Number(values[0]);
  return Number.isSafeInteger(value) ? value : INVALID;
}
function onlyAllowedKeys(params: URLSearchParams, allowed: string[]): boolean {
  return [...new Set(params.keys())].every(
    (key) => allowed.includes(key) && params.getAll(key).length === 1,
  );
}
function isAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
