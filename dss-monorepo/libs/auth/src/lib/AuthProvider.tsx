'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AuthProfileError, fetchBffSession } from './auth-api';
import {
  SessionTimeoutDialog,
  type SessionTimeoutDialogProps,
} from './SessionTimeoutDialog';
import {
  useIdleSession,
  type IdleSessionOptions,
  type IdleSessionState,
} from './useIdleSession';
import type {
  AuthActions,
  AuthState,
  AuthUser,
  DSSRole,
} from '@dss-monorepo/auth-models';

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);
const SessionTimeoutContext = createContext<IdleSessionState | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  /** Origin of the BFF, for example https://bff.example.edu. */
  bffBaseUrl: string;
  /**
   * Idle-session handling. Enabled by default: activity keeps the BFF session
   * alive, inactivity ends it after a warning. Pass `false` to disable.
   */
  sessionTimeout?: false | IdleSessionOptions;
  /** Replaces the built-in warning dialog. */
  renderSessionWarning?: (props: SessionTimeoutDialogProps) => ReactNode;
}

const INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  error: null,
  user: null,
  // Tokens deliberately never enter React state in the BFF session model.
  token: null,
  lastLogin: null,
  isInitialized: false,
  permissions: [],
};

export function AuthProvider({
  bffBaseUrl,
  children,
  sessionTimeout,
  renderSessionWarning,
}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    void fetchBffSession(bffBaseUrl, abortController.signal)
      .then((session) => {
        if (!active) return;
        const user: AuthUser = { ...session.user, roles: session.roles };
        setState({
          ...INITIAL_STATE,
          isAuthenticated: user.isActive,
          isLoading: false,
          isInitialized: true,
          user: user.isActive ? user : null,
          error: user.isActive ? null : 'Tu cuenta está inactiva.',
          lastLogin: user.isActive ? new Date() : null,
          permissions: session.permissions,
        });
      })
      .catch((error: unknown) => {
        if (!active || abortController.signal.aborted) return;
        const unauthenticated =
          error instanceof AuthProfileError && error.status === 401;
        setState({
          ...INITIAL_STATE,
          isLoading: false,
          isInitialized: true,
          error: unauthenticated ? null : 'No fue posible verificar tu sesión.',
        });
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, [bffBaseUrl]);

  const login = useCallback((requestedReturnTo?: string) => {
    const returnTo = resolveReturnTo(requestedReturnTo);
    window.location.assign(
      `${bffBaseUrl.replace(/\/$/, '')}/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [bffBaseUrl]);

  const logout = useCallback(() => {
    window.location.assign(`${bffBaseUrl.replace(/\/$/, '')}/api/auth/logout`);
  }, [bffBaseUrl]);

  const idleSession = useIdleSession({
    bffBaseUrl,
    enabled: sessionTimeout !== false && state.isAuthenticated,
    // Ends the Keycloak SSO session too, so the next visit asks for credentials.
    onExpired: logout,
    ...(sessionTimeout || {}),
  });

  const register = useCallback((requestedReturnTo?: string) => {
    const returnTo = resolveReturnTo(requestedReturnTo);
    window.location.assign(
      `${bffBaseUrl.replace(/\/$/, '')}/api/auth/login?action=register&returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [bffBaseUrl]);

  const getToken = useCallback(
    async (): Promise<string | undefined> => undefined,
    [],
  );
  const getUser = useCallback((): AuthUser | null => state.user, [state.user]);
  const hasRole = useCallback(
    (role: DSSRole): boolean => state.user?.roles.includes(role) ?? false,
    [state.user],
  );
  const hasPermission = useCallback(
    (permission: string): boolean => state.permissions.includes(permission),
    [state.permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      register,
      getToken,
      getUser,
      hasRole,
      hasPermission,
    }),
    [state, login, logout, register, getToken, getUser, hasRole, hasPermission],
  );

  let warning: ReactNode = null;
  if (idleSession.secondsLeft !== null) {
    const warningProps: SessionTimeoutDialogProps = {
      secondsLeft: idleSession.secondsLeft,
      reason: idleSession.reason,
      onContinue: idleSession.extend,
      onLogout: logout,
    };
    warning = renderSessionWarning ? (
      renderSessionWarning(warningProps)
    ) : (
      <SessionTimeoutDialog {...warningProps} />
    );
  }

  return (
    <AuthContext.Provider value={value}>
      <SessionTimeoutContext.Provider value={idleSession}>
        {children}
        {warning}
      </SessionTimeoutContext.Provider>
    </AuthContext.Provider>
  );
}

/** Idle-session state for portals that render their own countdown UI. */
export function useSessionTimeout(): IdleSessionState {
  const context = useContext(SessionTimeoutContext);
  if (!context) throw new Error('useSessionTimeout must be used within an AuthProvider');
  return context;
}

/** Obtiene el contexto de sesión del BFF. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

/** Keeps the original protected location after the callback failure screen. */
function getCurrentPortalReturnTo(): string {
  const current = new URL(window.location.href);
  const requested = current.searchParams.get('returnTo');
  if (!requested) {
    return current.toString();
  }

  try {
    const target = new URL(requested, current.origin);
    return target.origin === current.origin
      ? target.toString()
      : current.toString();
  } catch {
    return current.toString();
  }
}

function resolveReturnTo(requestedReturnTo?: string): string {
  // React click handlers receive a MouseEvent. Treat any accidental non-string
  // argument as an omitted return target instead of coercing it to
  // "[object Object]" and redirecting to a broken local path.
  if (typeof requestedReturnTo !== 'string' || !requestedReturnTo.trim()) {
    return getCurrentPortalReturnTo();
  }

  const current = new URL(window.location.href);
  try {
    const target = new URL(requestedReturnTo, current.origin);
    return target.origin === current.origin ? target.toString() : current.toString();
  } catch {
    return current.toString();
  }
}
