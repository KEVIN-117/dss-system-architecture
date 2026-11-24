import { listMlJobs, type MlJobListQuery } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../_lib/ml-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Jobs of every operator (training, extraction, forecast), newest first. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = params.get('limit');
  const query: MlJobListQuery = {
    kind: (params.get('kind') ?? undefined) as MlJobListQuery['kind'],
    status: (params.get('status') ?? undefined) as MlJobListQuery['status'],
    studyId: params.get('study_id') ?? undefined,
    limit: limit === null ? undefined : Number(limit),
  };
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], ({ serviceUrl, token, options }) =>
    listMlJobs(serviceUrl, token, query, options));
}
