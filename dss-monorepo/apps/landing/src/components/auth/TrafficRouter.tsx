'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';

import { useAuth } from '@dss-monorepo/auth';
import { getHighestRole } from '@dss-monorepo/rbac';
import { AccessDenied } from '@dss-monorepo/design-system';

const PORTAL_URLS = {
  SUPERADMIN: process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL,
  RECTOR: process.env.NEXT_PUBLIC_RECTOR_DASHBOARD_URL,
  DECANO: process.env.NEXT_PUBLIC_DECANO_DASHBOARD_URL,
  DIRECTOR: process.env.NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL,
} as const;

type PortalRole = keyof typeof PORTAL_URLS;

/** Resolves only absolute HTTP(S) destinations configured for a DSS role. */
export function resolvePortalUrl(
  role: PortalRole | null,
  portalUrls: Partial<Record<PortalRole, string | undefined>> = PORTAL_URLS,
): string | null {
  if (!role || !portalUrls[role]) return null;

  try {
    const target = new URL(portalUrls[role] as string);
    return ['http:', 'https:'].includes(target.protocol)
      ? target.toString()
      : null;
  } catch {
    return null;
  }
}

export function TrafficRouter() {
  const { isAuthenticated, isInitialized, isLoading, user, error } = useAuth();
  const [routingError, setRoutingError] = useState<string | null>(null);
  const highestRole = useMemo(
    () => getHighestRole(user?.roles ?? []),
    [user?.roles],
  );
  const configuredTargetUrl = highestRole
    ? PORTAL_URLS[highestRole]
    : undefined;
  const targetUrl = resolvePortalUrl(highestRole);

  useEffect(() => {
    if (
      isLoading ||
      !isInitialized ||
      !isAuthenticated ||
      !user ||
      !highestRole
    ) {
      return;
    }

    if (!configuredTargetUrl) {
      setRoutingError(`No hay una URL configurada para el rol ${highestRole}.`);
      return;
    }

    if (!targetUrl) {
      setRoutingError('La URL del portal asignado no es válida.');
      return;
    }

    window.location.replace(targetUrl);
  }, [
    configuredTargetUrl,
    highestRole,
    isAuthenticated,
    isInitialized,
    isLoading,
    targetUrl,
    user,
  ]);

  if (isLoading || !isInitialized) {
    return (
      <StatusMessage
        title="Verificando sesión"
        detail="Preparando tu portal DSS…"
      />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <StatusMessage
        title="No se pudo completar el inicio de sesión"
        detail={error ?? 'Vuelve a iniciar sesión para continuar.'}
        action={
          <Link className="text-primary underline" href="/login">
            Volver al inicio de sesión
          </Link>
        }
      />
    );
  }

  if (!highestRole) {
    return (
      <AccessDenied portalName="del ecosistema DSS" logoutHref={logoutUrl()} />
    );
  }

  if (routingError) {
    return (
      <StatusMessage title="No se pudo abrir tu portal" detail={routingError} />
    );
  }

  return (
    <StatusMessage
      title="Redirigiendo"
      detail={`Abriendo el portal de ${highestRole.toLowerCase()}…`}
    />
  );
}

function logoutUrl(): string | undefined {
  const bffBaseUrl = process.env.NEXT_PUBLIC_BFF_URL?.trim();
  return bffBaseUrl
    ? `${bffBaseUrl.replace(/\/$/, '')}/api/auth/logout`
    : undefined;
}

function StatusMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-lg">
        <h1 className="font-heading text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </section>
    </main>
  );
}
