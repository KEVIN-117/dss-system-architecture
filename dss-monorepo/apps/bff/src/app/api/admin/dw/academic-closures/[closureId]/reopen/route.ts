import { reopenAcademicPeriod } from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  parsePositiveId,
  readJsonBody,
  withDwControl,
} from '../../../_lib/dw-control-route';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ closureId: string }> },
): Promise<Response> {
  const { closureId: rawId } = await context.params;
  const closureId = parsePositiveId(rawId);
  const body = await readJsonBody(request);
  if (
    closureId === null ||
    !isRecord(body) ||
    !onlyKeys(body, ['reason']) ||
    typeof body.reason !== 'string'
  )
    return invalidDwRequest();
  return withDwControl(
    request,
    'DW_CLOSURE_MANAGE',
    (config, _authentication, signal) =>
      reopenAcademicPeriod(
        config,
        closureId,
        { reason: body.reason as string },
        signal,
      ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function onlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
