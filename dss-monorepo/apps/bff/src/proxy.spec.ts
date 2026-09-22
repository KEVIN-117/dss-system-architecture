import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from './proxy';

describe('BFF proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects API calls without a bearer token', () => {
    const response = proxy(new NextRequest('http://localhost:3006/api/auth/me'));

    expect(response.status).toBe(401);
  });

  it('allows CORS preflight only for configured dashboard origins', () => {
    vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://localhost:3001');
    const response = proxy(new NextRequest('http://localhost:3006/api/auth/me', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3001' },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3001');
  });
});
