'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@dss-monorepo/auth';

export function LandingAuthProvider({ children }: { children: ReactNode }) {
  const bffBaseUrl = process.env.NEXT_PUBLIC_BFF_URL?.trim();

  if (!bffBaseUrl) {
    return <AuthConfigurationError />;
  }

  return <AuthProvider bffBaseUrl={bffBaseUrl}>{children}</AuthProvider>;
}

function AuthConfigurationError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-xl border border-destructive/40 bg-card p-6 shadow-lg">
        <h1 className="font-heading text-lg font-semibold">
          Autenticación no configurada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El portal no tiene configurado el origen público del BFF.
        </p>
      </section>
    </main>
  );
}
