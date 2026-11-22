import { toggleSchedule } from '../_toggle';

export const runtime = 'nodejs';

/** Pauses a schedule. */
export function POST(
  request: Request,
  context: { params: Promise<{ scheduleId: string }> },
): Promise<Response> {
  return toggleSchedule(request, context, false);
}
