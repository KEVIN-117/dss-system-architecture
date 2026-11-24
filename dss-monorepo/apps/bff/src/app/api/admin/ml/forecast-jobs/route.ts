import { submitForecastJob, type ForecastJobRequest } from '@dss-monorepo/ml-connector';

import { idempotencyKey, ML_PERMISSIONS, readJsonBody, withPrediction } from '../_lib/ml-route';

export const runtime = 'nodejs';

/** Queues program forecasts of applications, admitted and enrolled students (202). */
export async function POST(request: Request): Promise<Response> {
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], async ({ serviceUrl, token, options }) =>
    submitForecastJob(serviceUrl, token, (await readJsonBody(request)) as ForecastJobRequest,
      idempotencyKey(request), options), 202);
}
