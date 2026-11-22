import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requirePermissions } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  // IAM-011/IAM-019: only the dw:* permission of the token opens DW routes.
  requirePermissions: vi.fn(),
}));

vi.mock('../../../_lib/auth-guard', () => ({
  authenticateRequest,
  requirePermissions,
}));

beforeEach(() => {
  requirePermissions.mockReturnValue(
    NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
  );
});

import { requireDwPermission, withDwControl } from './dw-control-route';

const authenticatedRequest = {
  authenticated: true as const,
  value: {
    token: 'verified-user-token',
    user: { sub: 'academic-authority-subject' },
    roles: [],
    permissions: ['dw:closure:read'],
  },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('DW control BFF route boundary', () => {
  it('checks service-specific permissions before forwarding the verified identity token', async () => {
    vi.stubEnv('DW_CONTROL_SERVICE_URL', 'http://dw-control-service:8090');
    authenticateRequest.mockResolvedValue(authenticatedRequest);
    requirePermissions.mockReturnValue(null);
    const action = vi.fn().mockResolvedValue({ result: 'ok' });

    const response = await withDwControl(
      new Request('http://bff/api/admin/dw/academic-closures'),
      'DW_CLOSURE_READ',
      action,
    );

    expect(response.status).toBe(200);
    expect(requirePermissions).toHaveBeenCalledWith(
      authenticatedRequest.value,
      ['dw:closure:read'],
    );
    expect(action).toHaveBeenCalledWith(
      {
        baseUrl: 'http://dw-control-service:8090',
        timeoutMs: 15_000,
        accessToken: 'verified-user-token',
      },
      authenticatedRequest.value,
      expect.any(AbortSignal),
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not call the DW service when the client-specific permission is missing', async () => {
    authenticateRequest.mockResolvedValue(authenticatedRequest);
    requirePermissions.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const action = vi.fn();

    const response = await withDwControl(
      new Request('http://bff/api/admin/dw/academic-closures'),
      'DW_CLOSURE_MANAGE',
      action,
    );

    expect(response.status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it('maps upstream errors to a safe response without echoing private details', async () => {
    vi.stubEnv('DW_CONTROL_SERVICE_URL', 'http://dw-control-service:8090');
    authenticateRequest.mockResolvedValue(authenticatedRequest);
    requirePermissions.mockReturnValue(null);
    const action = vi
      .fn()
      .mockRejectedValue(new Error('postgres password=private-value'));
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await withDwControl(
      new Request('http://bff/api/admin/dw/academic-closures'),
      'DW_CLOSURE_READ',
      action,
    );

    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).not.toContain('private-value');
    expect(body).toContain('DW_CONTROL_UNAVAILABLE');
    errorSpy.mockRestore();
  });

  it('requires the dw:* permission and nothing else (IAM-014, IAM-019)', () => {
    const value = authenticatedRequest.value as never;
    requirePermissions.mockReturnValueOnce(null);
    expect(requireDwPermission(value, 'DW_CLOSURE_MANAGE')).toBeNull();
    expect(requirePermissions).toHaveBeenLastCalledWith(value, ['dw:closure:manage']);

    // The retired DW_* client role no longer opens anything: only the permission check decides.
    expect(requireDwPermission(value, 'DW_CLOSURE_READ')?.status).toBe(403);
    expect(requirePermissions).toHaveBeenLastCalledWith(value, ['dw:closure:read']);
  });
});
