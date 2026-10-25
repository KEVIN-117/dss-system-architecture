import { listAcademicClosureEvents } from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  parsePositiveId,
  withDwControl,
} from '../../../_lib/dw-control-route';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ closureId: string }> },
): Promise<Response> {
  const { closureId: rawId } = await context.params;
  const closureId = parsePositiveId(rawId);
  if (closureId === null) return invalidDwRequest('Invalid closure ID');
  const query = parsePage(new URL(request.url).searchParams);
  if (!query) return invalidDwRequest('Invalid pagination');
  return withDwControl(
    request,
    'DW_CLOSURE_READ',
    (config, _authentication, signal) =>
      listAcademicClosureEvents(config, closureId, query, signal),
  );
}

function parsePage(
  params: URLSearchParams,
): { page?: number; size?: number } | null {
  const allowed = new Set(['page', 'size']);
  if (
    [...new Set(params.keys())].some((key) => !allowed.has(key)) ||
    [...allowed].some((key) => params.getAll(key).length > 1)
  )
    return null;
  const page = integerParam(params, 'page');
  const size = integerParam(params, 'size');
  if (
    page === null ||
    size === null ||
    (page !== undefined && page < 0) ||
    (size !== undefined && (size < 1 || size > 100))
  )
    return null;
  return {
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
