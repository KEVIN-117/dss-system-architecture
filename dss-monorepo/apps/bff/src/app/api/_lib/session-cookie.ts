import { CompactEncrypt, compactDecrypt } from 'jose';
import { webcrypto } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

import { getBffSessionConfig, type BffSessionConfig } from '../../../lib/bff-config';

/**
 * Server-side session state sealed into the HttpOnly cookie. Tokens never
 * reach browser JavaScript. All instants are epoch seconds.
 */
export interface BffSession {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt: number;
  /** Keycloak's refresh-token deadline (tracks the SSO session idle/max). */
  refreshTokenExpiresAt?: number;
  createdAt: number;
  lastActivityAt: number;
}

/** Back-compatible input: callers may omit timestamps; they default to "now". */
export type BffSessionInput = Pick<BffSession, 'accessToken'> & Partial<Omit<BffSession, 'accessToken'>>;

/** Kept for existing callers and tests that only care about the tokens. */
export type BffSessionTokens = Pick<BffSession, 'accessToken' | 'idToken'>;

export interface SealedSession {
  value: string;
  /** Cookie Max-Age in seconds. */
  maxAge: number;
  /** Epoch seconds at which the session ends unless renewed. */
  expiresAt: number;
}

const CONTENT_TYPE = 'dss-session+deflate';
const SESSION_VERSION = 1;
// Browsers drop cookies above ~4096 bytes (name + value). Stay well under.
const MAX_COOKIE_VALUE_LENGTH = 3800;
// Only used when a caller omits it; matches the realm accessTokenLifespan.
const DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS = 300;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Latest instant the session may still be used, given idle and absolute caps. */
export function sessionExpiresAt(
  session: BffSession,
  config: BffSessionConfig = getBffSessionConfig(),
): number {
  return Math.min(
    session.lastActivityAt + config.idleTimeoutSeconds,
    session.createdAt + config.maxLifetimeSeconds,
    // Without a refresh token the session cannot outlive its access token.
    session.refreshToken
      ? (session.refreshTokenExpiresAt ?? Number.POSITIVE_INFINITY)
      : session.accessTokenExpiresAt,
  );
}

export async function sealSession(
  input: BffSessionInput,
  now = nowSeconds(),
): Promise<SealedSession> {
  const config = getBffSessionConfig();
  const session: BffSession = {
    accessToken: input.accessToken,
    ...(input.idToken ? { idToken: input.idToken } : {}),
    ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
    accessTokenExpiresAt: input.accessTokenExpiresAt ?? now + DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS,
    ...(input.refreshTokenExpiresAt ? { refreshTokenExpiresAt: input.refreshTokenExpiresAt } : {}),
    createdAt: input.createdAt ?? now,
    lastActivityAt: input.lastActivityAt ?? now,
  };
  const expiresAt = sessionExpiresAt(session, config);
  const key = await getEncryptionKey(config.secret);

  let value = await encrypt(session, expiresAt, key);
  if (value.length > MAX_COOKIE_VALUE_LENGTH && session.idToken) {
    // The ID token is only a logout hint; dropping it keeps the session usable.
    console.warn('[bff-session] Session cookie too large; dropping ID token hint');
    const { idToken: _dropped, ...withoutIdToken } = session;
    value = await encrypt(withoutIdToken, expiresAt, key);
  }

  return { value, maxAge: Math.max(0, expiresAt - now), expiresAt };
}

export async function unsealSession(value: string): Promise<string | null> {
  const session = await unsealSessionTokens(value);
  return session?.accessToken ?? null;
}

/** Decrypts and validates the cookie; expired or malformed sessions yield null. */
export async function unsealSessionTokens(
  value: string,
  now = nowSeconds(),
): Promise<BffSession | null> {
  try {
    const config = getBffSessionConfig();
    const key = await getEncryptionKey(config.secret);
    const { plaintext, protectedHeader } = await compactDecrypt(value, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    });
    if (
      protectedHeader.alg !== 'dir' ||
      protectedHeader.enc !== 'A256GCM' ||
      protectedHeader.cty !== CONTENT_TYPE
    ) {
      return null;
    }

    const payload: unknown = JSON.parse(inflateRawSync(plaintext).toString('utf8'));
    const session = parseSession(payload);
    if (!session) {
      return null;
    }
    // Re-evaluated with the current configuration, not only the sealed `exp`.
    const exp = (payload as { exp: number }).exp;
    if (now >= exp || now >= sessionExpiresAt(session, config)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function encrypt(
  session: BffSession,
  expiresAt: number,
  key: Uint8Array,
): Promise<string> {
  // Copy into a plain Uint8Array: jose checks the realm-specific constructor.
  const plaintext = new Uint8Array(
    deflateRawSync(
      Buffer.from(JSON.stringify({ v: SESSION_VERSION, exp: expiresAt, ...session }), 'utf8'),
    ),
  );
  return new CompactEncrypt(plaintext)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', cty: CONTENT_TYPE })
    .encrypt(key);
}

function parseSession(value: unknown): BffSession | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    record.v !== SESSION_VERSION ||
    !isInteger(record.exp) ||
    typeof record.accessToken !== 'string' ||
    record.accessToken.length === 0 ||
    !isInteger(record.accessTokenExpiresAt) ||
    !isInteger(record.createdAt) ||
    !isInteger(record.lastActivityAt) ||
    !isOptionalString(record.idToken) ||
    !isOptionalString(record.refreshToken) ||
    (record.refreshTokenExpiresAt !== undefined && !isInteger(record.refreshTokenExpiresAt))
  ) {
    return null;
  }
  return {
    accessToken: record.accessToken,
    ...(typeof record.idToken === 'string' ? { idToken: record.idToken } : {}),
    ...(typeof record.refreshToken === 'string' ? { refreshToken: record.refreshToken } : {}),
    accessTokenExpiresAt: record.accessTokenExpiresAt,
    ...(isInteger(record.refreshTokenExpiresAt)
      ? { refreshTokenExpiresAt: record.refreshTokenExpiresAt }
      : {}),
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
  };
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length > 0);
}

async function getEncryptionKey(secret: string): Promise<Uint8Array> {
  const digest = await webcrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  );
  return new Uint8Array(digest);
}

/** Reads the session cookie value from a raw Cookie header. */
export function readSessionCookie(
  cookieHeader: string | null,
  cookieName = getBffSessionConfig().cookieName,
): string | null {
  const raw = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/** Rewrites one cookie inside a Cookie header (used to forward a renewed session). */
export function replaceSessionCookie(
  cookieHeader: string | null,
  value: string,
  cookieName = getBffSessionConfig().cookieName,
): string {
  const others = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${cookieName}=`));
  return [...others, `${cookieName}=${encodeURIComponent(value)}`].join('; ');
}

interface CookieWriter {
  cookies: { set(options: Record<string, unknown> & { name: string; value: string }): unknown };
}

export function setSessionCookie(response: CookieWriter, sealed: SealedSession): void {
  const config = getBffSessionConfig();
  response.cookies.set({
    name: config.cookieName,
    value: sealed.value,
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: sealed.maxAge,
  });
}

export function clearSessionCookie(response: CookieWriter): void {
  const config = getBffSessionConfig();
  response.cookies.set({
    name: config.cookieName,
    value: '',
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
