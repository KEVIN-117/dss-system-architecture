import { EncryptJWT, jwtDecrypt } from 'jose';
import { randomBytes, webcrypto } from 'node:crypto';

import { getBffSessionConfig } from '../../../lib/bff-config';

const TRANSACTION_TTL_SECONDS = 600;

export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  returnTo: string;
  action?: 'register';
}

export function getOAuthTransactionCookieName(): string {
  return `${getBffSessionConfig().cookieName}_oauth`;
}

export async function createOAuthTransaction(
  returnTo: string,
  action?: 'register',
): Promise<OAuthTransaction> {
  const codeVerifier = randomValue(64);
  return {
    state: randomValue(32),
    nonce: randomValue(32),
    codeVerifier,
    codeChallenge: await sha256Base64Url(codeVerifier),
    returnTo,
    action,
  };
}

export async function sealOAuthTransaction(transaction: OAuthTransaction): Promise<string> {
  const config = getBffSessionConfig();
  const key = await getEncryptionKey(config.secret, 'oauth-transaction');
  return new EncryptJWT({ ...transaction })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${TRANSACTION_TTL_SECONDS}s`)
    .encrypt(key);
}

export async function unsealOAuthTransaction(value: string): Promise<OAuthTransaction | null> {
  try {
    const config = getBffSessionConfig();
    const key = await getEncryptionKey(config.secret, 'oauth-transaction');
    const { payload, protectedHeader } = await jwtDecrypt(value, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    });
    if (protectedHeader.alg !== 'dir' || protectedHeader.enc !== 'A256GCM') {
      return null;
    }
    return isOAuthTransaction(payload)
      ? {
          state: payload.state,
          nonce: payload.nonce,
          codeVerifier: payload.codeVerifier,
          codeChallenge: payload.codeChallenge,
          returnTo: payload.returnTo,
          ...(payload.action === 'register' ? { action: payload.action } : {}),
        }
      : null;
  } catch {
    return null;
  }
}

export function oauthTransactionCookieOptions(maxAge = TRANSACTION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: getBffSessionConfig().secure,
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge,
  };
}

export function safeReturnTo(
  value: string | null,
  fallback: string,
  allowedOrigins: readonly string[],
): string {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, fallback);
    return allowedOrigins.includes(parsed.origin) ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function randomValue(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(digest).toString('base64url');
}

async function getEncryptionKey(secret: string, purpose: string): Promise<Uint8Array> {
  const digest = await webcrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${purpose}:${secret}`),
  );
  return new Uint8Array(digest);
}

function isOAuthTransaction(
  value: Record<string, unknown>,
): value is OAuthTransaction & Record<string, unknown> {
  return typeof value.state === 'string' && typeof value.nonce === 'string' &&
    typeof value.codeVerifier === 'string' && typeof value.codeChallenge === 'string' &&
    typeof value.returnTo === 'string' &&
    (value.action === undefined || value.action === 'register');
}
