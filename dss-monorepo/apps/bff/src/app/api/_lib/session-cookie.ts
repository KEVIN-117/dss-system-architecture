import { EncryptJWT, jwtDecrypt } from 'jose';
import { webcrypto } from 'node:crypto';

import { getBffSessionConfig } from '../../../lib/bff-config';

export interface BffSessionTokens {
  accessToken: string;
  idToken?: string;
}

async function getEncryptionKey(secret: string): Promise<Uint8Array> {
  const digest = await webcrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  );

  return new Uint8Array(digest);
}

export async function sealSession(tokens: BffSessionTokens): Promise<{
  value: string;
  maxAge: number;
}> {
  const config = getBffSessionConfig();
  const key = await getEncryptionKey(config.secret);
  const payload = tokens;
  const value = await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${config.ttlSeconds}s`)
    .encrypt(key);

  return { value, maxAge: config.ttlSeconds };
}

export async function unsealSession(value: string): Promise<string | null> {
  const session = await unsealSessionTokens(value);
  return session?.accessToken ?? null;
}

export async function unsealSessionTokens(value: string): Promise<BffSessionTokens | null> {
  try {
    const config = getBffSessionConfig();
    const key = await getEncryptionKey(config.secret);
    const { payload, protectedHeader } = await jwtDecrypt(value, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    });

    if (protectedHeader.alg !== 'dir' || protectedHeader.enc !== 'A256GCM') {
      return null;
    }

    const accessToken = payload.accessToken;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      return null;
    }
    if (payload.idToken !== undefined && typeof payload.idToken !== 'string') {
      return null;
    }
    return {
      accessToken,
      ...(typeof payload.idToken === 'string' ? { idToken: payload.idToken } : {}),
    };
  } catch {
    return null;
  }
}
