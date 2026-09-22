import {
  createRemoteJWKSet,
  jwtVerify,
  type JWSAlgorithm,
  type JWTPayload,
} from 'jose';

import {
  isDSSRole,
  type DSSRole,
  type KeycloakTokenClaims,
  type VerifiedToken,
} from '@dss-monorepo/auth-models';

export interface KeycloakJwtVerificationOptions {
  /** Keycloak base URL, preserving an optional deployment path such as /auth. */
  keycloakUrl: string;
  realm: string;
  /** Expected audience of tokens consumed by the BFF. */
  audience: string;
  /** Client whose resource roles carry the DSS authorities. */
  roleClientId: string;
  /** Keycloak uses RS256 by default; override only when the realm is configured differently. */
  algorithms?: readonly JWSAlgorithm[];
}

export class JwtVerificationError extends Error {
  constructor(message = 'Invalid or expired access token') {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

const jwksByUri = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Verifies Keycloak token signature, issuer, audience, mandatory expiry and
 * subject claims. JWKS resolvers are cached per realm rather than globally.
 */
export async function verifyKeycloakJwt(
  token: string,
  options: KeycloakJwtVerificationOptions,
): Promise<VerifiedToken> {
  if (token.trim().length === 0) {
    throw new JwtVerificationError();
  }

  const issuerUrl = realmUrl(options.keycloakUrl, options.realm);
  const jwksUrl = new URL('protocol/openid-connect/certs', issuerUrl);
  const jwks = getJwks(jwksUrl);

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: issuerUrl.toString().replace(/\/$/, ''),
      audience: options.audience,
      algorithms: [...(options.algorithms ?? ['RS256'])],
      requiredClaims: ['aud', 'exp', 'iss', 'sub'],
    });
    const claims = toKeycloakTokenClaims(payload);

    return {
      claims,
      roles: extractDssRoles(claims, options.roleClientId),
    };
  } catch (error) {
    if (error instanceof JwtVerificationError) {
      throw error;
    }
    throw new JwtVerificationError();
  }
}

export function extractDssRoles(
  claims: Pick<KeycloakTokenClaims, 'realm_access' | 'resource_access'>,
  roleClientId: string,
): DSSRole[] {
  const realmRoles = claims.realm_access?.roles ?? [];
  const clientRoles = claims.resource_access?.[roleClientId]?.roles ?? [];

  return [...new Set([...realmRoles, ...clientRoles])].filter(isDSSRole);
}

function getJwks(uri: URL): ReturnType<typeof createRemoteJWKSet> {
  const key = uri.toString();
  const existing = jwksByUri.get(key);
  if (existing) {
    return existing;
  }

  const jwks = createRemoteJWKSet(uri);
  jwksByUri.set(key, jwks);
  return jwks;
}

function realmUrl(keycloakUrl: string, realm: string): URL {
  const url = new URL(keycloakUrl);
  const basePath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  url.pathname = `${basePath}realms/${encodeURIComponent(realm)}/`;
  url.search = '';
  url.hash = '';
  return url;
}

function toKeycloakTokenClaims(payload: JWTPayload): KeycloakTokenClaims {
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.iss !== 'string' ||
    typeof payload.exp !== 'number' ||
    (typeof payload.aud !== 'string' && !Array.isArray(payload.aud))
  ) {
    throw new JwtVerificationError('Keycloak token has invalid required claims');
  }

  return {
    sub: payload.sub,
    iss: payload.iss,
    aud: payload.aud,
    exp: payload.exp,
    preferred_username: stringClaim(payload.preferred_username),
    email: stringClaim(payload.email),
    given_name: stringClaim(payload.given_name),
    family_name: stringClaim(payload.family_name),
    realm_access: accessClaim(payload.realm_access),
    resource_access: resourceAccessClaim(payload.resource_access),
  };
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function accessClaim(value: unknown): { roles: readonly string[] } | undefined {
  if (!isRecord(value) || !Array.isArray(value.roles)) {
    return undefined;
  }
  return { roles: value.roles.filter((role): role is string => typeof role === 'string') };
}

function resourceAccessClaim(
  value: unknown,
): Record<string, { roles: readonly string[] }> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([clientId, access]) => [clientId, accessClaim(access)] as const)
      .filter((entry): entry is readonly [string, { roles: readonly string[] }] => entry[1] !== undefined),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
