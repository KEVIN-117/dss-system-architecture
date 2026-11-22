import {
  AuthServiceClientError,
  JwtVerificationError,
  fetchUserProfile,
  verifyKeycloakJwt,
} from '@dss-monorepo/auth-connector';
import type { AuthUser, DSSRole } from '@dss-monorepo/auth-models';
import {
  isRbacAllowed,
  type DSSPermission,
  type RoleMatch,
} from '@dss-monorepo/rbac-server';
import { NextResponse } from 'next/server';

import {
  BffConfigurationError,
  getBffAuthConfig,
  getBffSessionCookieName,
} from '../../../lib/bff-config';
import { readSessionCookie, unsealSession } from './session-cookie';

export interface AuthenticatedRequest {
  user: AuthUser;
  /** Portal roles; for persona/portal decisions only. */
  roles: readonly DSSRole[];
  /** Permissions from the verified token (`resource_access.dss-permissions.roles`, IAM-014). */
  permissions: readonly string[];
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
        permissions: verified.permissions,
        token,
      },
    };
  } catch (error) {
    if (error instanceof BffConfigurationError) {
      console.error(
        '[bff] invalid authentication configuration',
        error.message,
      );
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: 'BFF authentication is unavailable' },
          { status: 500 },
        ),
      };
    }

    if (error instanceof AuthServiceClientError && error.status >= 500) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: 'Authentication service is unavailable' },
          { status: error.status === 504 ? 504 : 503 },
        ),
      };
    }

    if (
      !(error instanceof JwtVerificationError) &&
      !(error instanceof AuthServiceClientError)
    ) {
      console.error('[bff] unexpected authentication failure', error);
    }
    return unauthorized('Invalid or expired access token');
  }
}

async function resolveRequestToken(request: Request): Promise<string | null> {
  const bearerToken = extractBearerToken(request.headers.get('authorization'));
  if (bearerToken) {
    return bearerToken;
  }

  const sessionCookie = readSessionCookie(
    request.headers.get('cookie'),
    getBffSessionCookieName(),
  );
  // The proxy has already renewed the access token when needed and forwarded
  // the refreshed cookie, so the route only validates what it receives.
  return sessionCookie ? unsealSession(sessionCookie) : null;
}

/** Applies the shared DSS role hierarchy and fails closed without roles. */
export function requireRoles(
  authentication: AuthenticatedRequest,
  requiredRoles: readonly DSSRole[],
  match: RoleMatch = 'any',
): NextResponse | null {
  if (isRbacAllowed(authentication, { roles: requiredRoles, match })) {
    return null;
  }

  return NextResponse.json(
    { error: 'Insufficient permissions', requiredRoles },
    { status: 403 },
  );
}

/**
 * Requires permissions of the verified token (IAM-014). They are data managed from the admin portal,
 * so a new permission needs no BFF deployment. Fails closed without permissions.
 */
export function requirePermissions(
  authentication: AuthenticatedRequest,
  requiredPermissions: readonly DSSPermission[],
  match: RoleMatch = 'any',
): NextResponse | null {
  if (
    isRbacAllowed(authentication, {
      permissions: requiredPermissions,
      match,
    })
  ) {
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
