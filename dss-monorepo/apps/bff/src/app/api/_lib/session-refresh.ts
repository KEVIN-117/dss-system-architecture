import {
  KeycloakOidcClientError,
  refreshAccessToken,
  type KeycloakRefreshedTokenSet,
} from '@dss-monorepo/auth-connector';

import { getBffAuthConfig, getBffSessionConfig } from '../../../lib/bff-config';
import {
  nowSeconds,
  sealSession,
  unsealSessionTokens,
  type BffSession,
  type SealedSession,
} from './session-cookie';

export type SessionResolution =
  /** `sealed` is present when the cookie must be rewritten (renewed or touched). */
  | { status: 'valid'; session: BffSession; sealed?: SealedSession }
  /** Missing, tampered, idle, past its absolute lifetime, or rejected by Keycloak. */
  | { status: 'invalid' }
  /** Keycloak could not be reached and the access token is no longer usable. */
  | { status: 'unavailable' };

export interface ResolveSessionOptions {
  /** True only for explicit user-activity heartbeats; it extends the idle window. */
  touch?: boolean;
  now?: number;
}

/**
 * Validates the sealed session and transparently renews the Keycloak access
 * token shortly before it expires, so an active user is never logged out
 * while the SSO session is alive.
 */
export async function resolveSession(
  cookieValue: string | null,
  options: ResolveSessionOptions = {},
): Promise<SessionResolution> {
  if (!cookieValue) return { status: 'invalid' };
  const now = options.now ?? nowSeconds();
  const session = await unsealSessionTokens(cookieValue, now);
  if (!session) return { status: 'invalid' };

  const config = getBffSessionConfig();
  let next = session;
  let changed = false;

  if (session.accessTokenExpiresAt - now <= config.refreshLeewaySeconds) {
    if (!session.refreshToken) {
      return session.accessTokenExpiresAt > now
        ? { status: 'valid', session }
        : { status: 'invalid' };
    }
    try {
      const tokens = await refreshOnce(session.refreshToken);
      next = mergeRefreshedTokens(session, tokens, now);
      changed = true;
    } catch (error) {
      if (error instanceof KeycloakOidcClientError && error.reason === 'rejected') {
        return { status: 'invalid' };
      }
      console.error('[bff-session] Access token refresh failed', {
        reason: error instanceof KeycloakOidcClientError ? error.reason : 'unknown',
      });
      // Keep serving while the current token is still valid; never drop the
      // session for a transient identity-provider outage.
      return session.accessTokenExpiresAt > now
        ? { status: 'valid', session }
        : { status: 'unavailable' };
    }
  }

  if (options.touch) {
    next = { ...next, lastActivityAt: now };
    changed = true;
  }

  if (!changed) return { status: 'valid', session };
  const sealed = await sealSession(next, now);
  if (sealed.maxAge <= 0) return { status: 'invalid' };
  return { status: 'valid', session: next, sealed };
}

function mergeRefreshedTokens(
  session: BffSession,
  tokens: KeycloakRefreshedTokenSet,
  now: number,
): BffSession {
  return {
    ...session,
    accessToken: tokens.accessToken,
    idToken: tokens.idToken ?? session.idToken,
    refreshToken: tokens.refreshToken ?? session.refreshToken,
    accessTokenExpiresAt: now + tokens.expiresIn,
    refreshTokenExpiresAt: tokens.refreshExpiresIn
      ? now + tokens.refreshExpiresIn
      : session.refreshTokenExpiresAt,
  };
}

/**
 * Dashboards fire several API calls at once. They all carry the same cookie,
 * so a refresh is shared per refresh token and its result is reused briefly
 * for requests that left the browser before the new cookie arrived. This also
 * keeps the BFF compatible with Keycloak refresh-token rotation.
 */
const REFRESH_REUSE_WINDOW_MS = 30_000;
const MAX_TRACKED_REFRESHES = 1_000;
const inflightRefreshes = new Map<
  string,
  { promise: Promise<KeycloakRefreshedTokenSet>; settledAt?: number }
>();

function refreshOnce(refreshToken: string): Promise<KeycloakRefreshedTokenSet> {
  pruneRefreshCache(Date.now());
  const existing = inflightRefreshes.get(refreshToken);
  if (existing) return existing.promise;

  const entry: { promise: Promise<KeycloakRefreshedTokenSet>; settledAt?: number } = {
    promise: refreshAccessToken(getBffAuthConfig().oidc, refreshToken),
  };
  inflightRefreshes.set(refreshToken, entry);
  entry.promise.then(
    () => {
      entry.settledAt = Date.now();
    },
    () => {
      // Failures are not cached; the next request may retry.
      inflightRefreshes.delete(refreshToken);
    },
  );
  return entry.promise;
}

function pruneRefreshCache(now: number): void {
  for (const [key, entry] of inflightRefreshes) {
    if (entry.settledAt !== undefined && now - entry.settledAt > REFRESH_REUSE_WINDOW_MS) {
      inflightRefreshes.delete(key);
    }
  }
  while (inflightRefreshes.size > MAX_TRACKED_REFRESHES) {
    const oldest = inflightRefreshes.keys().next().value;
    if (oldest === undefined) break;
    inflightRefreshes.delete(oldest);
  }
}

/** Test hook. */
export function resetSessionRefreshCache(): void {
  inflightRefreshes.clear();
}
