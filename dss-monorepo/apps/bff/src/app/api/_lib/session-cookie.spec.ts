import { afterEach, describe, expect, it, vi } from 'vitest';

import { sealSession, unsealSession } from './session-cookie';

describe('BFF session cookie', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encrypts and decrypts the access token without exposing plaintext', async () => {
    vi.stubEnv('BFF_SESSION_SECRET', 'a-development-only-secret-that-is-not-committed');
    vi.stubEnv('BFF_SESSION_TTL_SECONDS', '300');

    const session = await sealSession({ accessToken: 'keycloak-access-token' });

    expect(session.value).not.toContain('keycloak-access-token');
    await expect(unsealSession(session.value)).resolves.toBe('keycloak-access-token');
  });

  it('fails closed when the cookie is tampered with', async () => {
    vi.stubEnv('BFF_SESSION_SECRET', 'a-development-only-secret-that-is-not-committed');

    const session = await sealSession({ accessToken: 'keycloak-access-token' });

    await expect(unsealSession(`${session.value}tampered`)).resolves.toBeNull();
  });

  it('requires a session secret and does not use a repository fallback', async () => {
    vi.stubEnv('BFF_SESSION_SECRET', '');

    await expect(sealSession({ accessToken: 'keycloak-access-token' })).rejects.toThrow(
      'BFF_SESSION_SECRET must be configured',
    );
  });
});
