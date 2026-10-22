import {
  AuthServiceClientError,
  listAdminUsers,
  type AdminUserDirectoryQuery,
} from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import { BffConfigurationError, getBffAuthConfig } from '../../../../lib/bff-config';
import { withCors } from '../../../../lib/cors';
import { authenticateRequest, requireRoles } from '../../_lib/auth-guard';

export const runtime = 'nodejs';

/** GET /api/admin/users — SUPERADMIN-only proxy to the Auth Service directory. */
export async function GET(request: Request): Promise<NextResponse> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) return withCors(request, authentication.response);

  const forbidden = requireRoles(authentication.value, ['SUPERADMIN']);
  if (forbidden) return withCors(request, forbidden);

  const query = parseDirectoryQuery(new URL(request.url).searchParams);
  if (!query) {
    return withCors(request, NextResponse.json({ error: 'Invalid user directory filters' }, { status: 400 }));
  }

  try {
    const config = getBffAuthConfig();
    const page = await listAdminUsers(config.authServiceUrl, authentication.value.token, query, request.signal);
    return withCors(request, NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } }));
  } catch (error) {
    return withCors(request, mapDirectoryError(error));
  }
}

function parseDirectoryQuery(params: URLSearchParams): AdminUserDirectoryQuery | null {
  const q = params.get('q') ?? undefined;
  const role = params.get('role') ?? undefined;
  const activeValue = params.get('active');
  const facultyValue = params.get('facultyId');
  const careerId = params.get('careerId') ?? undefined;
  const pageValue = params.get('page');
  const sizeValue = params.get('size');
  const facultyId = facultyValue === null ? undefined : Number(facultyValue);
  const page = pageValue === null ? 0 : Number(pageValue);
  const size = sizeValue === null ? 20 : Number(sizeValue);

  if ((q !== undefined && q.length > 120) || (role !== undefined && role.length > 50)) return null;
  if (activeValue !== null && activeValue !== 'true' && activeValue !== 'false') return null;
  if (facultyValue !== null && (!Number.isInteger(facultyId) || facultyId === undefined || facultyId < 0)) return null;
  if (careerId !== undefined && !/^[A-Za-z0-9]{3}$/.test(careerId)) return null;
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100) return null;

  return {
    ...(q === undefined ? {} : { q }),
    ...(activeValue === null ? {} : { active: activeValue === 'true' }),
    ...(role === undefined ? {} : { role }),
    ...(facultyId === undefined ? {} : { facultyId }),
    ...(careerId === undefined ? {} : { careerId }),
    page,
    size,
  };
}

function mapDirectoryError(error: unknown): NextResponse {
  if (error instanceof BffConfigurationError) {
    console.error('[bff-admin] invalid auth-service configuration', error.message);
    return NextResponse.json({ error: 'Admin integration is unavailable' }, { status: 500 });
  }
  if (error instanceof AuthServiceClientError) {
    const status = error.status === 504 ? 504 : error.status >= 400 && error.status < 500 ? error.status : 502;
    return NextResponse.json({ error: 'Unable to list users', upstreamStatus: error.status }, { status });
  }
  console.error('[bff-admin] auth-service user directory request failed', error);
  return NextResponse.json({ error: 'Auth service is unavailable' }, { status: 502 });
}
