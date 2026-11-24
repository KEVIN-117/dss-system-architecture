import { getForecasts, type ForecastQuery } from '@dss-monorepo/ml-connector';

import { ML_PERMISSIONS, withPrediction } from '../_lib/ml-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Latest program forecasts; ML operators and holders of prediction:forecast:read may read them. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query: ForecastQuery = {
    series: (params.get('series') ?? '') as ForecastQuery['series'],
    programRef: params.get('program_ref') ?? undefined,
    cadence: (params.get('cadence') ?? undefined) as ForecastQuery['cadence'],
  };
  return withPrediction(request, [ML_PERMISSIONS.TRAIN, ML_PERMISSIONS.FORECAST_READ], ({ serviceUrl, token, options }) =>
    getForecasts(serviceUrl, token, query, options));
}
