import { cancelMlJob } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../../../_lib/ml-route';

export const runtime = 'nodejs';

/** Cancels a queued or running job; a running one discards its partial output. */
export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const { jobId } = await context.params;
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], ({ serviceUrl, token, options }) =>
    cancelMlJob(serviceUrl, token, jobId, options));
}
