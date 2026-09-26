import * as React from 'react';
import { LogIn, UserPlus } from 'lucide-react';

import { Button } from '../atoms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../molecules/card';

export interface AuthLandingProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  onLogin: () => void;
  onRegister?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Public portal entry point. Credentials intentionally belong to the
 * Keycloak-hosted login theme; this component only starts the BFF flow.
 */
export function AuthLanding({
  title = 'Sistema de Soporte a la Decisión',
  description = 'Accede con tus credenciales institucionales.',
  onLogin,
  onRegister,
  isLoading = false,
  error,
  className,
  ...props
}: AuthLandingProps) {
  return (
    <main
      className={`flex min-h-screen items-center justify-center bg-background p-6 text-foreground${className ? ` ${className}` : ''}`}
      {...props}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button className="w-full" size="lg" onClick={onLogin} disabled={isLoading}>
            <LogIn aria-hidden="true" />
            {isLoading ? 'Verificando sesión…' : 'Iniciar sesión'}
          </Button>
          {onRegister ? (
            <Button className="w-full" variant="outline" onClick={onRegister} disabled={isLoading}>
              <UserPlus aria-hidden="true" />
              Crear cuenta
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  );
}
