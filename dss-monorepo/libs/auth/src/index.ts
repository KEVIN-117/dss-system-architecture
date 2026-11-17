// Issue #82 R4: exportar Provider y Hook tipado
export { AuthProvider, useAuth, useSessionTimeout } from './lib/AuthProvider';
export type { AuthProviderProps } from './lib/AuthProvider';
export { ProtectedRoute } from './lib/ProtectedRoute';
export {
  LandingLoginRedirect,
  landingLoginUrl,
  portalReturnTo,
} from './lib/LandingLoginRedirect';
export type {
  LandingLoginRedirectProps,
  LandingLoginTarget,
} from './lib/LandingLoginRedirect';
export type { ProtectedRouteProps } from './lib/ProtectedRoute';
export {
  AuthProfileError,
  fetchBffSession,
  parseBffSessionResponse,
  refreshBffSession,
} from './lib/auth-api';
export type { BffSessionHeartbeat, BffSessionResponse } from './lib/auth-api';
export { SessionTimeoutDialog } from './lib/SessionTimeoutDialog';
export type { SessionTimeoutDialogProps } from './lib/SessionTimeoutDialog';
export type { IdleSessionOptions, IdleSessionState } from './lib/useIdleSession';
