import { toggleSchedule } from '../_toggle';

export const runtime = 'nodejs';

/** Re-enables a schedule; dw-control-service validates it again against the DSA operating hours. */
export function POST(
  request: Request,
  context: { params: Promise<{ scheduleId: string }> },
): Promise<Response> {
  return toggleSchedule(request, context, true);
}
