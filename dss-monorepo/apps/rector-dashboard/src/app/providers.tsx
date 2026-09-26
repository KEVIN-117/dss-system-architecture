'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@dss-monorepo/auth';

interface ProvidersProps {
  children: ReactNode;
  bffBaseUrl: string;
}

export function Providers({ children, bffBaseUrl }: ProvidersProps) {
  return <AuthProvider bffBaseUrl={bffBaseUrl}>{children}</AuthProvider>;
}
