export {
  AuthServiceClientError,
  AuthServiceIamError,
  callAuthServiceIam,
  fetchUserProfile,
  getAcademicCatalog,
  getAdminUser,
  isAcademicContextAssignmentRequest,
  listAdminUsers,
  replaceUserAcademicContexts,
} from './clients/auth-service-client.js';
export type {
  IamCall,
  IamCallResult,
  IamHttpMethod,
  AcademicCatalog,
  AcademicCareerOption,
  AcademicFacultyOption,
  AdminUserDirectoryEntry,
  AdminUserDirectoryPage,
  AdminUserDirectoryQuery,
  AcademicContextAssignment,
  ReplaceUserAcademicContextsRequest,
} from './clients/auth-service-client.js';
export {
  extractDssRoles,
  extractPermissions,
  DEFAULT_PERMISSIONS_CLIENT_ID,
  JwtVerificationError,
  verifyKeycloakIdToken,
  verifyKeycloakJwt,
} from './jwt/jwt-verifier.js';
export type {
  KeycloakIdTokenVerificationOptions,
  KeycloakJwtVerificationOptions,
} from './jwt/jwt-verifier.js';
export {
  createAuthorizationUrl,
  createLogoutUrl,
  exchangeAuthorizationCode,
  KeycloakOidcClientError,
  refreshAccessToken,
} from './oidc/keycloak-oidc-client.js';
export type {
  AuthorizationCodeExchange,
  AuthorizationRequest,
  KeycloakOidcClientConfig,
  KeycloakRefreshedTokenSet,
  KeycloakTokenSet,
} from './oidc/keycloak-oidc-client.js';
