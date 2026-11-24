import { submitTrainingStudy, type TrainingStudyRequest } from '@dss-monorepo/ml-connector';

import { idempotencyKey, ML_PERMISSIONS, readJsonBody, withPrediction } from '../_lib/ml-route';

export const runtime = 'nodejs';

/** Queues one training job per algorithm on the same dataset (202). */
export async function POST(request: Request): Promise<Response> {
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], async ({ serviceUrl, token, options }) =>
    submitTrainingStudy(serviceUrl, token, (await readJsonBody(request)) as TrainingStudyRequest,
      idempotencyKey(request), options), 202);
}
