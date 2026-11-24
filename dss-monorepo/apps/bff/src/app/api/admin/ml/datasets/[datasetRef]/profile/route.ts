import { getDatasetProfile } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../../../_lib/ml-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Exploratory profile (EDA) of a dataset: aggregates only. */
export async function GET(request: Request, context: { params: Promise<{ datasetRef: string }> }): Promise<Response> {
  const { datasetRef } = await context.params;
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], ({ serviceUrl, token, options }) =>
    getDatasetProfile(serviceUrl, token, decodeURIComponent(datasetRef), options));
}
