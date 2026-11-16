import * as React from 'react';
import { LogOut, ShieldX } from 'lucide-react';

import portalImage from '../assets/access-denied-portal.webp';
import { Button } from '../atoms/button';

// Vite resolves image imports to a URL string; Next.js resolves them to
// `StaticImageData`. Normalize so the organism renders in both hosts.
const portalImageSrc =
  typeof portalImage === 'string'
    ? portalImage
    : (portalImage as unknown as { src: string }).src;

export interface AccessDeniedProps extends React.HTMLAttributes<HTMLElement> {
  /** Human-readable name of the portal that denied access. */
  portalName: string;
  /** BFF logout endpoint used to end the current SSO session. */
  logoutHref?: string;
}

/**
 * Shared state for an authenticated user whose roles do not authorize access
 * to a portal. It intentionally does not offer another login action, which
 * would otherwise restart the same Keycloak SSO session.
 */
export function AccessDenied({
  portalName,
  logoutHref,
  className,
  ...props
}: AccessDeniedProps) {
  return (
    <main
      className={`flex min-h-screen items-center justify-center bg-background p-4 text-foreground sm:p-6${className ? ` ${className}` : ''}`}
      {...props}
    >
      <section
        role="alert"
        aria-labelledby="access-denied-title"
        className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl shadow-dss-navy-950/25 md:grid-cols-[1.1fr_1fr]"
      >
        <div className="relative h-64 overflow-hidden bg-dss-navy-950 sm:h-80 md:h-auto md:min-h-[34rem]">
          <img
            src={portalImageSrc}
            alt=""
            aria-hidden="true"
            decoding="async"
            className="absolute inset-0 size-full object-cover object-[50%_58%] md:object-[50%_45%]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-dss-navy-950/80 via-dss-navy-950/10 to-dss-navy-950/30"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-dss-cyan-400/40 to-transparent md:block"
          />
        </div>

        <div className="flex flex-col justify-center gap-6 p-6 sm:p-8 md:p-10">
          <p className="flex items-center gap-2 font-mono text-[0.7rem] font-medium tracking-[0.14em] text-destructive uppercase">
            <ShieldX className="size-4" aria-hidden="true" />
            Error 403 · Acceso restringido
          </p>

          <div className="space-y-3">
            <h1
              id="access-denied-title"
              className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl"
            >
              Acceso no autorizado
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Tu cuenta inició sesión, pero no tiene permisos para acceder al portal{' '}
              <span className="font-medium text-foreground">{portalName}</span>.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">¿Necesitas acceso?</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Solicita al administrador que revise los roles asignados a tu cuenta.
            </p>
          </div>

          {logoutHref ? (
            <Button asChild variant="outline" className="self-start">
              <a href={logoutHref}>
                <LogOut aria-hidden="true" />
                Cerrar sesión y cambiar de cuenta
              </a>
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
