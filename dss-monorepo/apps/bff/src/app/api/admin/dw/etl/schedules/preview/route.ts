import { previewEtlSchedule } from '@dss-monorepo/dw-control-connector/server';

import { invalidDwRequest, withDwControl } from '../../../_lib/dw-control-route';
import { integerValue, singleValuedQuery } from '../../_lib/etl-request';

export const runtime = 'nodejs';

/** Next occurrences of a cron expression against the DSA operating hours, and whether it would be accepted. */
export function GET(request: Request): Promise<Response> {
  const values = singleValuedQuery(new URL(request.url).searchParams, [
    'cronExpression',
    'timezone',
    'count',
  ]);
  const cronExpression = values?.get('cronExpression');
  const timezone = values?.get('timezone');
  const count = integerValue(values?.get('count'));
  if (!values || cronExpression === undefined || count === null)
    return Promise.resolve(invalidDwRequest('Invalid schedule preview request'));
  return withDwControl(
    request,
    'DW_ETL_MONITOR_READ',
    (config, _authentication, signal) =>
      previewEtlSchedule(
        config,
        {
          cronExpression,
          ...(timezone === undefined ? {} : { timezone }),
          ...(count === undefined ? {} : { count }),
        },
        signal,
      ),
  );
}
