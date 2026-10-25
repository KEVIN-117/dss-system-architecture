import { getAcademicClosure } from '@dss-monorepo/dw-control-connector/server';

import {
  invalidDwRequest,
  parsePositiveId,
  withDwControl,
} from '../../_lib/dw-control-route';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ closureId: string }> },
): Promise<Response> {
  const { closureId: rawId } = await context.params;
  const closureId = parsePositiveId(rawId);
  if (closureId === null) return invalidDwRequest('Invalid closure ID');
  return withDwControl(
    request,
    'DW_CLOSURE_READ',
    (config, _authentication, signal) =>
      getAcademicClosure(config, closureId, signal),
  );
}
