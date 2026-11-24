import { rollbackModel, type ModelRollbackRequest } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, readJsonBody, withPrediction } from '../../_lib/ml-route';

export const runtime = 'nodejs';

/** Restores the previously active model of an event and cadence (audited, reason required). */
export async function POST(request: Request): Promise<Response> {
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], async ({ serviceUrl, token, options }) =>
    rollbackModel(serviceUrl, token, (await readJsonBody(request)) as ModelRollbackRequest, options));
}
