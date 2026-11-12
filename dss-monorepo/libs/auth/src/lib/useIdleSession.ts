'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AuthProfileError, refreshBffSession } from './auth-api';

export interface IdleSessionOptions {
  /** Seconds before expiry when the warning appears. Default 120. */
  warningSeconds?: number;
  /** Minimum seconds between activity heartbeats to the BFF. Default 60. */
  heartbeatIntervalSeconds?: number;
}

export interface IdleSessionState {
  /** Seconds left before the session ends; null while no warning is due. */
  secondsLeft: number | null;
  /** 'absolute' when the max session lifetime, not inactivity, is the limit. */
  reason: 'idle' | 'absolute';
  /** Counts as user activity and immediately reports it to the BFF. */
  extend: () => void;
}

interface UseIdleSessionInput extends IdleSessionOptions {
  bffBaseUrl: string;
  enabled: boolean;
  onExpired: () => void;
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'] as const;
const ACTIVITY_THROTTLE_MS = 1_000;
const TICK_MS = 1_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const CHANNEL_NAME = 'dss-session';

type ChannelMessage = { type: 'activity'; at: number } | { type: 'expired' };

/**
 * Tracks user activity in the page (and in other tabs of the same portal) and
 * turns it into BFF heartbeats. While the user keeps working the session is
 * extended; after the idle window the session ends with a prior warning.
 */
export function useIdleSession({
  bffBaseUrl,
  enabled,
  onExpired,
  warningSeconds = 120,
  heartbeatIntervalSeconds = 60,
}: UseIdleSessionInput): IdleSessionState {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [reason, setReason] = useState<'idle' | 'absolute'>('idle');

  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(0);
  const heartbeatInFlightRef = useRef(false);
  const idleTimeoutMsRef = useRef(DEFAULT_IDLE_TIMEOUT_MS);
  const absoluteExpiresAtRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const expire = useCallback((broadcast: boolean) => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    if (broadcast) channelRef.current?.postMessage({ type: 'expired' } satisfies ChannelMessage);
    onExpiredRef.current();
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (heartbeatInFlightRef.current || expiredRef.current) return;
    heartbeatInFlightRef.current = true;
    // Set before the request so failures do not turn into a retry storm.
    lastHeartbeatRef.current = Date.now();
    try {
      const heartbeat = await refreshBffSession(bffBaseUrl);
      idleTimeoutMsRef.current = heartbeat.idleTimeoutSeconds * 1000;
      absoluteExpiresAtRef.current = heartbeat.absoluteExpiresAt;
    } catch (error) {
      if (error instanceof AuthProfileError && error.status === 401) {
        expire(true);
      }
      // Other failures (network, 503) are retried on the next interval.
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, [bffBaseUrl, expire]);

  const recordActivity = useCallback((at: number, broadcast: boolean) => {
    if (at <= lastActivityRef.current) return;
    lastActivityRef.current = at;
    if (broadcast) {
      channelRef.current?.postMessage({ type: 'activity', at } satisfies ChannelMessage);
    }
  }, []);

  const tick = useCallback(() => {
    if (expiredRef.current) return;
    const now = Date.now();
    const lastActivity = lastActivityRef.current;

    // Server-side expiry (e.g. Keycloak ended the SSO session) surfaces as a
    // 401 on the next heartbeat; locally we track idle and absolute limits.
    const idleDeadline = lastActivity + idleTimeoutMsRef.current;
    const absoluteDeadline = absoluteExpiresAtRef.current ?? Number.POSITIVE_INFINITY;
    const hasUnreportedActivity = lastActivity > lastHeartbeatRef.current;
    const deadline = Math.min(idleDeadline, absoluteDeadline);
    const remainingMs = deadline - now;

    if (remainingMs <= 0) {
      expire(true);
      return;
    }

    if (
      hasUnreportedActivity &&
      now - lastHeartbeatRef.current >= heartbeatIntervalSeconds * 1000
    ) {
      void sendHeartbeat();
    }

    if (remainingMs <= warningSeconds * 1000) {
      setReason(absoluteDeadline <= idleDeadline ? 'absolute' : 'idle');
      setSecondsLeft(Math.ceil(remainingMs / 1000));
    } else {
      setSecondsLeft(null);
    }
  }, [expire, heartbeatIntervalSeconds, sendHeartbeat, warningSeconds]);

  useEffect(() => {
    if (!enabled) return;
    expiredRef.current = false;
    lastActivityRef.current = Date.now();

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    if (channel) {
      channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
        if (event.data?.type === 'activity' && typeof event.data.at === 'number') {
          // Another tab already sent (or will send) the heartbeat.
          recordActivity(event.data.at, false);
          lastHeartbeatRef.current = Math.max(lastHeartbeatRef.current, event.data.at);
        } else if (event.data?.type === 'expired') {
          expire(false);
        }
      };
    }

    let lastSeen = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastSeen < ACTIVITY_THROTTLE_MS) return;
      lastSeen = now;
      recordActivity(now, true);
    };
    const onVisibility = () => {
      // Background tabs throttle timers; re-evaluate as soon as the tab is back.
      if (document.visibilityState === 'visible') tick();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(tick, TICK_MS);
    // Loading the page is activity: align the server idle window right away.
    void sendHeartbeat();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
      channel?.close();
      channelRef.current = null;
    };
  }, [enabled, expire, recordActivity, sendHeartbeat, tick]);

  const extend = useCallback(() => {
    recordActivity(Date.now(), true);
    void sendHeartbeat().then(tick);
  }, [recordActivity, sendHeartbeat, tick]);

  return { secondsLeft: enabled ? secondsLeft : null, reason, extend };
}
