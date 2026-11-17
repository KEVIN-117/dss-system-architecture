import { NextResponse } from 'next/server';

import { getBffSessionConfig } from '../../../../lib/bff-config';
import { withCors } from '../../../../lib/cors';
import {
  readSessionCookie,
  sessionExpiresAt,
  unsealSessionTokens,
} from '../../_lib/session-cookie';

export const runtime = 'nodejs';

/**
 * POST /api/auth/refresh
 *
 * Activity heartbeat sent by the portals while the user interacts with the
 * page. The proxy has already extended the idle window (and renewed the
 * Keycloak access token if needed) before this handler runs; this route only
 * reports the resulting deadlines so the portal can schedule its idle warning.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cookie = readSessionCookie(request.headers.get('cookie'));
  const session = cookie ? await unsealSessionTokens(cookie) : null;
  if (!session) {
    return withCors(
      request,
      NextResponse.json({ error: 'Session expired' }, { status: 401 }),
    );
  }

  const config = getBffSessionConfig();
  return withCors(
    request,
    NextResponse.json(
      {
        expiresAt: sessionExpiresAt(session, config) * 1000,
        absoluteExpiresAt: (session.createdAt + config.maxLifetimeSeconds) * 1000,
        idleTimeoutSeconds: config.idleTimeoutSeconds,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  );
}
