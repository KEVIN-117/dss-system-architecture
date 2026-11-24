import { compareModels } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../../_lib/ml-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Compares 2-6 candidates (?ids=a,b); selection uses validation metrics only. */
export async function GET(request: Request): Promise<Response> {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], ({ serviceUrl, token, options }) =>
    compareModels(serviceUrl, token, ids, options));
}
