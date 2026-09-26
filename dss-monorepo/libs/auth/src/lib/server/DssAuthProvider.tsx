'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../AuthProvider';

export interface DssAuthProviderProps {
  children: ReactNode;
  bffBaseUrl: string;
}

/**
 * Server Component Wrapper para la autenticación.
 * El navegador solo recibe el origen público del BFF. Las credenciales del
 * cliente OIDC, la URL de Keycloak y auth-service permanecen en el BFF.
 */
export function DssAuthProvider({
  bffBaseUrl,
  children,
}: DssAuthProviderProps) {
  return (
    <AuthProvider
      bffBaseUrl={bffBaseUrl}
    >
      {children}
    </AuthProvider>
  );
}
