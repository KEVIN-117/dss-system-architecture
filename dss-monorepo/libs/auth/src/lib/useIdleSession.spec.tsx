import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIdleSession } from './useIdleSession';

const BFF = 'http://localhost:3006';

function heartbeatResponse(idleTimeoutSeconds = 300): Response {
  const now = Date.now();
  return new Response(
    JSON.stringify({
      expiresAt: now + idleTimeoutSeconds * 1000,
      absoluteExpiresAt: now + 10 * 60 * 60 * 1000,
      idleTimeoutSeconds,
    }),
    { status: 200 },
  );
}

describe('useIdleSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends a heartbeat on load and again only after user activity', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(heartbeatResponse()));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useIdleSession({ bffBaseUrl: BFF, enabled: true, onExpired: vi.fn() }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BFF}/api/auth/refresh`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      (globalThis as unknown as EventTarget).dispatchEvent(new Event('keydown'));
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('warns before the idle deadline and expires the session afterwards', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(heartbeatResponse(300))));
    const onExpired = vi.fn();

    const { result } = renderHook(() =>
      useIdleSession({ bffBaseUrl: BFF, enabled: true, onExpired, warningSeconds: 60 }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.secondsLeft).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(240_000);
    });
    expect(result.current.secondsLeft).not.toBeNull();
    expect(result.current.secondsLeft).toBeLessThanOrEqual(60);
    expect(result.current.reason).toBe('idle');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('extending the session clears the warning', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(heartbeatResponse(300))));

    const { result } = renderHook(() =>
      useIdleSession({ bffBaseUrl: BFF, enabled: true, onExpired: vi.fn(), warningSeconds: 60 }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250_000);
    });
    expect(result.current.secondsLeft).not.toBeNull();

    await act(async () => {
      result.current.extend();
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.secondsLeft).toBeNull();
  });

  it('expires immediately when the BFF reports the session is gone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    const onExpired = vi.fn();

    renderHook(() => useIdleSession({ bffBaseUrl: BFF, enabled: true, onExpired }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useIdleSession({ bffBaseUrl: BFF, enabled: false, onExpired: vi.fn() }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
