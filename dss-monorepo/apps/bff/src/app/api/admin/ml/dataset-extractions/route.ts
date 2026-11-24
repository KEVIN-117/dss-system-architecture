import { submitDatasetExtraction, type DatasetExtractionRequest } from '@dss-monorepo/ml-connector';

import { idempotencyKey, ML_PERMISSIONS, readJsonBody, withPrediction } from '../_lib/ml-route';

export const runtime = 'nodejs';

/** Queues a DW extraction (202); the job's result_ref is the dataset once it succeeds. */
export async function POST(request: Request): Promise<Response> {
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], async ({ serviceUrl, token, options }) =>
    submitDatasetExtraction(serviceUrl, token, (await readJsonBody(request)) as DatasetExtractionRequest,
      idempotencyKey(request), options), 202);
}
