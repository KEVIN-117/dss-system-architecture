'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AuthProfileError, fetchCurrentUser } from './auth-api';
import { extractRoles, filterDSSRoles, getKeycloak, initializeKeycloak } from './keycloak';
import type { AuthActions, AuthState, AuthUser, DSSRole } from './types';

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  keycloakUrl: string;
  realm: string;
  clientId: string;
  /** Origin of auth-service, for example https://auth.example.edu.bo. */
  authServiceUrl: string;
}

const INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  error: null,
  user: null,
  token: null,
  lastLogin: null,
  isInitialized: false,
  permissions: [],
};

const TOKEN_REFRESH_MARGIN_SECONDS = 60;
const REFRESH_CHECK_INTERVAL_MS = 30_000;

export function AuthProvider({
  authServiceUrl,
  children,
  clientId,
  keycloakUrl,
  realm,
}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();
    const keycloak = getKeycloak({ url: keycloakUrl, realm, clientId });

    const clearRefreshInterval = () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };

    const markUnauthenticated = (error: string | null) => {
      if (active) {
        setState({
          ...INITIAL_STATE,
          isLoading: false,
          isInitialized: true,
          error,
        });
      }
    };

    const startTokenRefresh = () => {
      clearRefreshInterval();
      refreshIntervalRef.current = setInterval(async () => {
        try {
          const refreshed = await keycloak.updateToken(TOKEN_REFRESH_MARGIN_SECONDS);
          if (active && refreshed && keycloak.token) {
            setState((previous) => ({ ...previous, token: keycloak.token ?? null }));
          }
        } catch {
          clearRefreshInterval();
          markUnauthenticated('La sesión expiró. Inicia sesión nuevamente.');
          void keycloak.logout({ redirectUri: window.location.origin });
        }
      }, REFRESH_CHECK_INTERVAL_MS);
    };

    void initializeKeycloak(keycloak, {
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      flow: 'standard',
    })
      .then(async (authenticated) => {
        if (!authenticated) {
          markUnauthenticated(null);
          return;
        }

        const token = keycloak.token;
        if (!token) {
          markUnauthenticated('Keycloak no devolvió un access token válido.');
          return;
        }

        try {
          const profile = await fetchCurrentUser(authServiceUrl, token, abortController.signal);
          if (!active) {
            return;
          }

          const user: AuthUser = {
            ...profile,
            roles: filterDSSRoles(extractRoles(keycloak, clientId)) as DSSRole[],
          };

          if (!user.isActive) {
            markUnauthenticated('Tu cuenta está inactiva.');
            return;
          }

          setState({
            isAuthenticated: true,
            isLoading: false,
            error: null,
            user,
            token,
            lastLogin: new Date(),
            isInitialized: true,
            permissions: [],
          });
          startTokenRefresh();
        } catch (error) {
          if (abortController.signal.aborted) {
            return;
          }
          markUnauthenticated(profileErrorMessage(error));
        }
      })
      .catch(() => {
        markUnauthenticated('No se pudo inicializar la autenticación.');
      });

    return () => {
      active = false;
      abortController.abort();
      clearRefreshInterval();
    };
  }, [authServiceUrl, clientId, keycloakUrl, realm]);

  const login = useCallback(() => {
    void getKeycloak().login();
  }, []);

  const logout = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setState({ ...INITIAL_STATE, isLoading: false, isInitialized: true });
    void getKeycloak().logout({ redirectUri: window.location.origin });
  }, []);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    const keycloak = getKeycloak();
    try {
      await keycloak.updateToken(TOKEN_REFRESH_MARGIN_SECONDS);
      if (keycloak.token) {
        setState((previous) => ({ ...previous, token: keycloak.token ?? null }));
      }
      return keycloak.token;
    } catch {
      return undefined;
    }
  }, []);

  const register = useCallback(() => {
    void getKeycloak().register();
  }, []);

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
      getToken,
      register,
      getUser,
      hasRole,
      hasPermission,
    }),
    [state, login, logout, getToken, register, getUser, hasRole, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function profileErrorMessage(error: unknown): string {
  if (error instanceof AuthProfileError && error.status === 404) {
    return 'Tu perfil todavía no fue sincronizado. Contacta al administrador.';
  }
  if (error instanceof AuthProfileError && (error.status === 401 || error.status === 403)) {
    return 'No fue posible validar tu sesión.';
  }
  return 'No fue posible verificar tu perfil de usuario.';
}

/** Obtiene el contexto de autenticación. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
