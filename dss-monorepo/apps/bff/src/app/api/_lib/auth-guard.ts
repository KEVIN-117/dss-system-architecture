import {
  AuthServiceClientError,
  JwtVerificationError,
  fetchUserProfile,
  verifyKeycloakJwt,
} from '@dss-monorepo/auth-connector';
import type { AuthUser, DSSRole } from '@dss-monorepo/auth-models';
import {
  hasRequiredPermissions,
  hasRequiredRoles,
  type DSSPermission,
  type RoleMatch,
} from '@dss-monorepo/rbac/server';
import { NextResponse } from 'next/server';

import {
  BffConfigurationError,
  getBffAuthConfig,
  getBffSessionCookieName,
} from '../../../lib/bff-config';
import { unsealSession } from './session-cookie';

export interface AuthenticatedRequest {
  user: AuthUser;
  roles: readonly DSSRole[];
  token: string;
}

export type AuthenticationResult =
  | { authenticated: true; value: AuthenticatedRequest }
  | { authenticated: false; response: NextResponse };

/**
 * Resolves a bearer token or encrypted BFF session, validates it through the
 * auth connector, then retrieves the local user profile through that same
 * connector. No external request is made by the BFF itself.
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthenticationResult> {
  const token = await resolveRequestToken(request);
  if (!token) {
    return unauthorized('Authentication required');
  }

  try {
    const config = getBffAuthConfig();
    const verified = await verifyKeycloakJwt(token, config.keycloak);
    const profile = await fetchUserProfile(config.authServiceUrl, token);
    if (!profile.isActive) {
      return unauthorized('Account is inactive');
    }

    return {
      authenticated: true,
      value: {
        user: { ...profile, roles: verified.roles },
        roles: verified.roles,
        token,
      },
    };
  } catch (error) {
    if (error instanceof BffConfigurationError) {
      console.error('[bff] invalid authentication configuration', error.message);
      return {
        authenticated: false,
        response: NextResponse.json({ error: 'BFF authentication is unavailable' }, { status: 500 }),
      };
    }

    if (!(error instanceof JwtVerificationError) && !(error instanceof AuthServiceClientError)) {
      console.error('[bff] unexpected authentication failure', error);
    }
    return unauthorized('Invalid or expired access token');
  }
}

async function resolveRequestToken(
  request: Request,
): Promise<string | null> {
  const bearerToken = extractBearerToken(request.headers.get('authorization'));
  if (bearerToken) {
    return bearerToken;
  }

  const cookieName = getBffSessionCookieName();
  const sessionCookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (!sessionCookie) {
    return null;
  }

  try {
    return unsealSession(decodeURIComponent(sessionCookie));
  } catch {
    return null;
  }
}

/** Applies the shared DSS role hierarchy and fails closed without roles. */
export function requireRoles(
  authentication: AuthenticatedRequest,
  requiredRoles: readonly DSSRole[],
  match: RoleMatch = 'any',
): NextResponse | null {
  if (hasRequiredRoles(authentication.roles, requiredRoles, match)) {
    return null;
  }

  return NextResponse.json(
    { error: 'Insufficient permissions', requiredRoles },
    { status: 403 },
  );
}

/** Applies the shared DSS permission map and fails closed without permissions. */
export function requirePermissions(
  authentication: AuthenticatedRequest,
  requiredPermissions: readonly DSSPermission[],
  match: RoleMatch = 'any',
): NextResponse | null {
  if (hasRequiredPermissions(authentication.roles, requiredPermissions, match)) {
    return null;
  }

  return NextResponse.json(
    { error: 'Insufficient permissions', requiredPermissions },
    { status: 403 },
  );
}

export function extractBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

function unauthorized(message: string): AuthenticationResult {
  return {
    authenticated: false,
    response: NextResponse.json({ error: message }, { status: 401 }),
  };
}
