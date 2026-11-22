import { GraduationCap } from 'lucide-react';
import { cn } from 'cn';

export interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

/* Thin ring cut out of a conic gradient, as in the landing gateway emblem. */
const RING_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))';

/**
 * Status indicator for session checks and other indeterminate operations.
 *
 * - Inline (default inside pages): transparent, so it sits on glass cards,
 *   tables and dialogs without drawing a box of its own.
 * - Full screen (session checks): a frosted panel over the ambient backdrop,
 *   the same scene as the landing gateway.
 *
 * It fades in after a short delay so fast responses never flash a loader, and
 * every loop stops under prefers-reduced-motion; the message stays readable.
 */
export function Loader({
  text = 'Verificando sesión…',
  fullScreen = true,
  className,
}: LoaderProps) {
  const content = (
    <div className="flex flex-col items-center gap-4">
      <LoaderEmblem size={fullScreen ? 'lg' : 'md'} />
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-sm font-medium text-foreground text-balance">
          {text}
        </p>
        <span
          aria-hidden="true"
          className={cn(
            'relative block h-1 overflow-hidden rounded-full bg-(--glass-track)',
            fullScreen ? 'w-40' : 'w-28',
          )}
        >
          <span className="absolute inset-y-0 w-2/5 animate-ds-sweep rounded-full bg-linear-to-r from-transparent via-dss-cyan-400 to-transparent motion-reduce:hidden" />
        </span>
      </div>
    </div>
  );

  return (
    <section
      role="status"
      aria-live="polite"
      data-slot="loader"
      data-fullscreen={fullScreen}
      className={cn(
        'relative flex items-center justify-center p-6 text-foreground',
        fullScreen
          ? 'isolate min-h-screen overflow-hidden bg-background'
          : 'min-h-48',
        className,
      )}
    >
      {fullScreen ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <div className="absolute top-1/2 left-1/2 size-[34rem] -translate-x-[65%] -translate-y-[60%] rounded-full bg-(--orb-primary) blur-[110px]" />
            <div className="absolute top-1/2 left-1/2 size-[26rem] -translate-x-[20%] -translate-y-[25%] rounded-full bg-(--orb-role) blur-[110px]" />
          </div>
          <div className="glass-surface hairline-top relative w-full max-w-xs animate-ds-rise overflow-hidden rounded-3xl border border-(--glass-border) px-8 py-9 shadow-raised [animation-delay:120ms]">
            {content}
          </div>
        </>
      ) : (
        <div className="animate-ds-fade [animation-delay:120ms]">{content}</div>
      )}
    </section>
  );
}

function LoaderEmblem({ size }: { size: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid place-items-center',
        size === 'lg' ? 'size-20' : 'size-14',
      )}
    >
      {/* Soft glow in the portal's role colour. */}
      <span className="absolute inset-1 rounded-full bg-role-accent/25 blur-xl" />
      {/* Static track, then the travelling arc: role accent into brand cyan. */}
      <span className="absolute inset-0 rounded-full border border-(--glass-border)" />
      <span
        className="absolute inset-0 animate-ds-spin rounded-full motion-reduce:animate-none"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0 55%, var(--role-accent) 78%, var(--dss-cyan-400) 100%)',
          mask: RING_MASK,
          WebkitMask: RING_MASK,
        }}
      />
      <span
        className={cn(
          'glass-surface relative grid place-items-center rounded-full border border-(--glass-border) text-role-accent shadow-glass',
          size === 'lg' ? 'size-12' : 'size-9',
        )}
      >
        <GraduationCap className={size === 'lg' ? 'size-5' : 'size-4'} strokeWidth={1.8} />
      </span>
    </span>
  );
}
