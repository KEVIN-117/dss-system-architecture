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
  /** Catalog client whose roles are the permissions (`dss-permissions`, IAM-014). */
  permissionsClientId?: string;
  /**
   * Realm roles that open a portal besides the four known ones, as `{ role: portalRole }`
   * (for example `{ "VICERRECTOR": "RECTOR" }`). New roles are mapped, not discarded.
   */
  portalRoles?: Readonly<Record<string, DSSRole>>;
  /** Keycloak uses RS256 by default; override only when the realm is configured differently. */
  algorithms?: readonly JWSAlgorithm[];
}

export interface KeycloakIdTokenVerificationOptions {
  /** Keycloak base URL, preserving an optional deployment path such as /auth. */
  keycloakUrl: string;
  realm: string;
  /** The confidential BFF client that initiated the authorization request. */
  audience: string;
  /** Nonce generated for the matching authorization transaction. */
  nonce: string;
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
      roles: extractDssRoles(claims, options.portalRoles),
      permissions: extractPermissions(
        claims,
        options.permissionsClientId ?? DEFAULT_PERMISSIONS_CLIENT_ID,
      ),
    };
  } catch (error) {
    if (error instanceof JwtVerificationError) {
      throw error;
    }
    throw new JwtVerificationError();
  }
}

/**
 * Checks that the ID token was issued for the same authorization transaction.
 * Access tokens are validated separately against the resource-server audience.
 */
export async function verifyKeycloakIdToken(
  token: string,
  options: KeycloakIdTokenVerificationOptions,
): Promise<void> {
  const issuerUrl = realmUrl(options.keycloakUrl, options.realm);
  const jwks = getJwks(new URL('protocol/openid-connect/certs', issuerUrl));

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: issuerUrl.toString().replace(/\/$/, ''),
      audience: options.audience,
      algorithms: [...(options.algorithms ?? ['RS256'])],
      requiredClaims: ['aud', 'exp', 'iss', 'sub', 'nonce'],
    });
    if (payload.nonce !== options.nonce) {
      throw new JwtVerificationError('ID token nonce does not match');
    }
  } catch (error) {
    if (error instanceof JwtVerificationError) {
      throw error;
    }
    throw new JwtVerificationError('Invalid ID token');
  }
}

export const DEFAULT_PERMISSIONS_CLIENT_ID = 'dss-permissions';

/**
 * Portal roles of the token: the known DSS roles among realm roles, plus realm roles mapped to a portal
 * role through `portalRoles`. Client roles never open a portal (the legacy `uatf-auth-service` roles
 * were retired in IAM-019).
 */
export function extractDssRoles(
  claims: Pick<KeycloakTokenClaims, 'realm_access'>,
  portalRoles: Readonly<Record<string, DSSRole>> = {},
): DSSRole[] {
  const realmRoles = claims.realm_access?.roles ?? [];
  const mapped = realmRoles.flatMap((role) =>
    Object.prototype.hasOwnProperty.call(portalRoles, role) ? [portalRoles[role]] : [],
  );

  return [...new Set([...realmRoles, ...mapped])].filter(isDSSRole);
}

/** `resource_access.<permissionsClientId>.roles`; roles of any other client are not permissions. */
export function extractPermissions(
  claims: Pick<KeycloakTokenClaims, 'resource_access'>,
  permissionsClientId: string = DEFAULT_PERMISSIONS_CLIENT_ID,
): string[] {
  return [...new Set(claims.resource_access?.[permissionsClientId]?.roles ?? [])];
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
