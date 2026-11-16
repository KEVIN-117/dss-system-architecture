'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@dss-monorepo/auth';

import { LandingAuthProvider } from '@/components/auth/LandingAuthProvider';
import {
  authCallbackPath,
  currentPortalReturnTo,
} from '@/components/auth/portal-return';
import { GatewayEyebrow, GatewayScene } from '@/components/auth/GatewayScene';

export default function LoginPage() {
  return (
    <LandingAuthProvider>
      <LoginContent />
    </LandingAuthProvider>
  );
}

function LoginContent() {
  const {
    isAuthenticated,
    isLoading,
    error: sessionError,
    login,
    register,
  } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const isBusy = isLoading || isStarting;
  // A failed callback explains more than a generic session check.
  const error = callbackError ?? sessionError;

  // Failed Keycloak callbacks land here directly or forwarded by a portal.
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get('error') ===
      'authentication_failed'
    ) {
      setCallbackError(
        'No fue posible iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.',
      );
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.replace(authCallbackPath(currentPortalReturnTo()));
    }
  }, [isAuthenticated, isLoading]);

  // Carries a validated portal deep link through Keycloak and the callback.
  const callbackUrl = () =>
    new URL(
      authCallbackPath(currentPortalReturnTo()),
      window.location.origin,
    ).toString();

  return (
    <GatewayScene
      image="/images/portal-login.webp"
      imagePosition="origin-top object-[50%_30%] lg:object-[50%_0%]"
      tone={error ? 'error' : 'working'}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 p-1.5">
          <Image
            src="/images/dsa.png"
            alt="Escudo de la Dirección de Servicios Académicos"
            width={36}
            height={36}
            className="object-contain"
          />
        </span>
        <div className="leading-tight">
          <GatewayEyebrow>UATF · DSA</GatewayEyebrow>
          <p className="mt-1 text-sm font-medium text-white/80">
            Dirección de Servicios Académicos
          </p>
        </div>
      </div>

      <h1 className="mt-8 bg-linear-to-br from-white via-white to-dss-cyan-400/80 bg-clip-text font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance text-transparent sm:text-[2.25rem]">
        Portal de Servicios Académicos
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">
        Inicia sesión con tu cuenta institucional para entrar al portal que
        corresponde a tu rol.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-6 flex gap-3 rounded-2xl border border-dss-red-500/40 bg-dss-red-500/10 p-4 text-sm leading-relaxed text-red-200"
        >
          <AlertIcon />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            setIsStarting(true);
            login(callbackUrl());
          }}
          className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-dss-cyan-400 to-dss-blue-500 px-5 text-sm font-semibold text-dss-navy-950 shadow-[0_10px_30px_-10px] shadow-dss-cyan-400/70 transition-[transform,box-shadow,filter] hover:-translate-y-px hover:shadow-[0_14px_36px_-10px] hover:shadow-dss-cyan-400/90 hover:brightness-110 disabled:pointer-events-none disabled:opacity-70"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-[left,opacity] duration-700 group-hover:left-[110%] group-hover:opacity-100"
          />
          {isBusy ? <SpinnerIcon /> : <LoginIcon />}
          {isBusy ? 'Verificando sesión…' : 'Iniciar sesión'}
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            setIsStarting(true);
            register(callbackUrl());
          }}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-medium text-white/90 transition-colors hover:border-dss-cyan-400/50 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
        >
          <UserPlusIcon />
          Crear cuenta
        </button>
      </div>

      <p className="mt-8 flex gap-3 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/50">
        <LockIcon />
        <span>
          Te llevaremos al servicio de identidad de la universidad. Tu
          contraseña nunca pasa por este portal.
        </span>
      </p>
    </GatewayScene>
  );
}

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" strokeWidth={2} {...iconProps}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" strokeWidth={2} {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 animate-spin"
      strokeWidth={2.4}
      {...iconProps}
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 size-4 shrink-0"
      strokeWidth={2}
      {...iconProps}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-px size-4 shrink-0 text-dss-cyan-400/80"
      strokeWidth={2}
      {...iconProps}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
