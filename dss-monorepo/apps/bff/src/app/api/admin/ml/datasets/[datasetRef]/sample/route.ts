import { getDatasetSample } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../../../_lib/ml-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** First pseudonymised rows of a dataset, declared fields only. */
export async function GET(request: Request, context: { params: Promise<{ datasetRef: string }> }): Promise<Response> {
  const { datasetRef } = await context.params;
  const limit = new URL(request.url).searchParams.get('limit');
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], ({ serviceUrl, token, options }) =>
    getDatasetSample(serviceUrl, token, decodeURIComponent(datasetRef), limit === null ? 50 : Number(limit), options));
}
