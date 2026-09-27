import * as React from 'react';
import { LogOut, ShieldX } from 'lucide-react';

import { Button } from '../atoms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '../molecules/card';

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
      className={`flex min-h-screen items-center justify-center bg-background p-6 text-foreground${className ? ` ${className}` : ''}`}
      {...props}
    >
      <Card className="w-full max-w-md" role="alert" aria-labelledby="access-denied-title">
        <CardHeader>
          <ShieldX className="size-8 text-destructive" aria-hidden="true" />
          <h1
            id="access-denied-title"
            className="font-heading text-base leading-snug font-medium"
          >
            Acceso no autorizado
          </h1>
          <CardDescription>
            Tu cuenta inició sesión, pero no tiene permisos para acceder al portal {portalName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Si necesitas acceso, solicita al administrador que revise los roles asignados a tu cuenta.
          </p>
        </CardContent>
        {logoutHref ? (
          <CardFooter className="justify-end">
            <Button asChild variant="outline">
              <a href={logoutHref}>
                <LogOut aria-hidden="true" />
                Cerrar sesión y cambiar de cuenta
              </a>
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </main>
  );
}
