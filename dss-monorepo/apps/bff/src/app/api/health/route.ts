import { NextResponse } from 'next/server';

/** Public liveness endpoint for local tooling and orchestrator readiness probes. */
export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok' });
}
