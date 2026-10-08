'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@dss-monorepo/auth';

export function Providers({
  children,
  bffBaseUrl,
}: {
  children: ReactNode;
  bffBaseUrl: string;
}) {
  return <AuthProvider bffBaseUrl={bffBaseUrl}>{children}</AuthProvider>;
}
