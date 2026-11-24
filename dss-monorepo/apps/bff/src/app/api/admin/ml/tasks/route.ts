import { listMlTasks } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../_lib/ml-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Prediction targets and forecast series of the catalog (forms of the ML Studio). */
export async function GET(request: Request): Promise<Response> {
  return withPrediction(request, [ML_PERMISSIONS.TRAIN], ({ serviceUrl, token, options }) =>
    listMlTasks(serviceUrl, token, options));
}
