import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createOAuthTransaction,
  safeReturnTo,
  sealOAuthTransaction,
  unsealOAuthTransaction,
} from './oauth-transaction';

describe('OAuth transaction', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('seals the state, nonce and PKCE verifier and restores the same transaction', async () => {
    vi.stubEnv('BFF_SESSION_SECRET', 'a-development-only-secret-that-is-not-committed');
    const transaction = await createOAuthTransaction('http://localhost:3000/', 'register');
    const encrypted = await sealOAuthTransaction(transaction);

    expect(encrypted).not.toContain(transaction.state);
    await expect(unsealOAuthTransaction(encrypted)).resolves.toEqual(transaction);
    expect(transaction.codeChallenge).not.toBe(transaction.codeVerifier);
  });

  it('accepts post-login locations only from an allowed portal origin', () => {
    const fallback = 'http://localhost:3000/';
    const allowed = ['http://localhost:3000'];

    expect(safeReturnTo('http://localhost:3000/dashboard', fallback, allowed))
      .toBe('http://localhost:3000/dashboard');
    expect(safeReturnTo('https://attacker.example/phish', fallback, allowed)).toBe(fallback);
    expect(safeReturnTo('/relative', fallback, allowed)).toBe('http://localhost:3000/relative');
  });
});
