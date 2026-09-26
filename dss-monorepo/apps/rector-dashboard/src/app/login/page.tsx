'use client';

import { useAuth } from '@dss-monorepo/auth';
import { AuthLanding } from '@dss-monorepo/design-system';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { error, isAuthenticated, isLoading, login } = useAuth();
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'authentication_failed') {
      setCallbackError('No fue posible iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.');
    }
    if (isAuthenticated) window.location.replace('/');
  }, [isAuthenticated]);

  return <AuthLanding onLogin={login} isLoading={isLoading} error={error ?? callbackError} />;
}
