// Issue #82 R4: exportar Provider y Hook tipado
export { AuthProvider, useAuth } from './lib/AuthProvider';
export type { AuthProviderProps } from './lib/AuthProvider';
export { ProtectedRoute } from './lib/ProtectedRoute';
export type { ProtectedRouteProps } from './lib/ProtectedRoute';
export { getKeycloak, initializeKeycloak, extractRoles, filterDSSRoles } from './lib/keycloak';
export { AuthProfileError, fetchCurrentUser, parseAuthUserProfile } from './lib/auth-api';
