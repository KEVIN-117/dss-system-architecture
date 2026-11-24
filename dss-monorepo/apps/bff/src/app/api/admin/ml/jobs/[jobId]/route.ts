import { getMlJob } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../../_lib/ml-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const { jobId } = await context.params;
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], ({ serviceUrl, token, options }) =>
    getMlJob(serviceUrl, token, jobId, options));
}
