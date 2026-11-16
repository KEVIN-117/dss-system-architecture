'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';

import { useAuth } from '@dss-monorepo/auth';
import { getHighestRole } from '@dss-monorepo/rbac';
import { AccessDenied } from '@dss-monorepo/design-system';

import { GatewayEyebrow, GatewayScene, type GatewayTone } from './GatewayScene';
import {
  currentPortalReturnTo,
  pickPortalDestination,
  PORTAL_URLS,
  type PortalRole,
  type PortalUrls,
} from './portal-return';

/** Resolves only absolute HTTP(S) destinations configured for a DSS role. */
export function resolvePortalUrl(
  role: PortalRole | null,
  portalUrls: PortalUrls = PORTAL_URLS,
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

    // Reopen the page the user asked for when it belongs to their portal.
    window.location.replace(
      pickPortalDestination(targetUrl, currentPortalReturnTo()),
    );
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
        tone="working"
        step="session"
        title="Verificando sesión"
        detail="Preparando tu portal DSS…"
      />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <StatusMessage
        tone="error"
        step="session"
        title="No se pudo completar el inicio de sesión"
        detail={error ?? 'Vuelve a iniciar sesión para continuar.'}
        action={
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:border-dss-cyan-400/50 hover:bg-white/15"
          >
            Volver al inicio de sesión
            <ArrowIcon />
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
      <StatusMessage
        tone="error"
        step="portal"
        title="No se pudo abrir tu portal"
        detail={routingError}
      />
    );
  }

  return (
    <StatusMessage
      tone="working"
      step="portal"
      progress
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

const GATEWAY_STEPS = [
  { id: 'session', label: 'Sesión' },
  { id: 'role', label: 'Rol' },
  { id: 'portal', label: 'Portal' },
] as const;

type GatewayStep = (typeof GATEWAY_STEPS)[number]['id'];
type StepState = 'done' | 'active' | 'error' | 'pending';

const STEP_STATE_LABEL: Record<StepState, string> = {
  done: 'completado',
  active: 'en curso',
  error: 'con error',
  pending: 'pendiente',
};

/**
 * Scene shown behind the panel: the traveler waits at the portal while the
 * session resolves, walks through it once the portal is known, and finds it
 * cracked when routing fails. `active` steps keep the waiting scene.
 */
type SceneState = Exclude<StepState, 'active'>;

const SCENE_IMAGES: Record<SceneState, string> = {
  pending: '/images/gateway-pending.webp',
  done: '/images/gateway-done.webp',
  error: '/images/gateway-error.webp',
};

const SCENE_IMAGE_LIST = Object.values(SCENE_IMAGES);

function stepState(
  index: number,
  currentIndex: number,
  tone: GatewayTone,
): StepState {
  if (index < currentIndex) return 'done';
  if (index > currentIndex) return 'pending';
  return tone === 'error' ? 'error' : 'active';
}

/**
 * Frosted-glass status panel floating over the portal scene. The step rail
 * mirrors the real routing sequence: session → highest role → portal.
 */
function StatusMessage({
  title,
  detail,
  action,
  tone,
  step,
  progress = false,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
  tone: GatewayTone;
  step: GatewayStep;
  progress?: boolean;
}) {
  const currentIndex = GATEWAY_STEPS.findIndex((item) => item.id === step);
  const isError = tone === 'error';
  const scene: SceneState = isError ? 'error' : progress ? 'done' : 'pending';

  return (
    <GatewayScene
      image={SCENE_IMAGES[scene]}
      scenes={SCENE_IMAGE_LIST}
      tone={tone}
      panelProps={{ 'aria-live': 'polite', 'aria-busy': !isError }}
    >
      <div className="relative flex items-center justify-between">
        <GatewayEyebrow />
        <span key={tone} className="gateway-fade">
          <StatusEmblem tone={tone} />
        </span>
      </div>

      {/* Re-keyed on every message so new copy fades in instead of snapping. */}
      <div key={title} className="gateway-fade">
        <h1 className="relative mt-8 font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        <p className="relative mt-3 text-sm leading-relaxed text-white/65 sm:text-base">
          {detail}
        </p>
      </div>

      <ol
        className="relative mt-8 flex items-center gap-2"
        aria-label="Progreso del acceso"
      >
        {GATEWAY_STEPS.map((item, index) => {
          const state = stepState(index, currentIndex, tone);
          const labelColor =
            state === 'pending'
              ? 'text-white/35'
              : state === 'error'
                ? 'text-red-300'
                : 'text-white/85';
          return (
            <li key={item.id} className="flex flex-1 items-center gap-2">
              <StepDot state={state} />
              <span
                className={`text-xs font-medium transition-colors duration-500 ${labelColor}`}
              >
                {item.label}
                <span className="sr-only"> ({STEP_STATE_LABEL[state]})</span>
              </span>
              {index < GATEWAY_STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 transition-colors duration-500 ${index < currentIndex ? 'bg-linear-to-r from-dss-cyan-400/80 to-dss-blue-500/60' : 'bg-white/10'}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {progress ? (
        <div
          aria-hidden="true"
          className="relative mt-6 h-1 overflow-hidden rounded-full bg-white/10"
        >
          <div className="gateway-sweep absolute inset-y-0 w-2/5 rounded-full bg-linear-to-r from-transparent via-dss-cyan-400 to-transparent" />
        </div>
      ) : null}

      {action ? <div className="relative mt-8">{action}</div> : null}
    </GatewayScene>
  );
}

const SPINNER_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))';

function StatusEmblem({ tone }: { tone: GatewayTone }) {
  if (tone === 'error') {
    return (
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-full border border-dss-red-500/40 bg-dss-red-500/15 text-red-300 shadow-[0_0_24px_-4px] shadow-dss-red-500/60"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="relative grid size-11 place-items-center"
    >
      <span className="absolute inset-0 rounded-full border border-white/10" />
      <span
        className="gateway-spin absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0 55%, var(--dss-blue-500) 75%, var(--dss-cyan-400) 100%)',
          mask: SPINNER_MASK,
          WebkitMask: SPINNER_MASK,
        }}
      />
      <span className="size-2 rounded-full bg-dss-cyan-400 shadow-[0_0_12px] shadow-dss-cyan-400" />
    </span>
  );
}

function StepDot({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-full bg-dss-cyan-400/20 text-dss-cyan-400 ring-1 ring-dss-cyan-400/50"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span
        aria-hidden="true"
        className="relative grid size-5 shrink-0 place-items-center"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-dss-cyan-400/40" />
        <span className="size-2.5 rounded-full bg-dss-cyan-400 shadow-[0_0_10px] shadow-dss-cyan-400" />
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-full bg-dss-red-500/20 ring-1 ring-dss-red-500/60"
      >
        <span className="size-2 rounded-full bg-red-400" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-white/15"
    >
      <span className="size-1.5 rounded-full bg-white/25" />
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
