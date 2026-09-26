'use client';

/** Entry point used by a server layout to configure the client AuthProvider. */
export type { AcademicContext, AuthUser, AuthUserProfile, DSSRole } from '@dss-monorepo/auth-models';
export { DssAuthProvider } from './lib/server/DssAuthProvider';
export type { DssAuthProviderProps } from './lib/server/DssAuthProvider';
