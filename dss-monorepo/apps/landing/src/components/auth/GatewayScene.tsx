import type { HTMLAttributes, ReactNode } from 'react';

export type GatewayTone = 'working' | 'error';

/**
 * Full-bleed portal scene with a frosted-glass panel floating over it. Shared
 * by the login entry point and the post-login traffic router so every step of
 * the authentication journey reads as the same place.
 */
export function GatewayScene({
  image,
  scenes = [],
  imagePosition = 'object-[50%_38%] lg:object-[50%_45%]',
  tone = 'working',
  panelProps,
  children,
}: {
  /** Public path of the portrait scene image. */
  image: string;
  /**
   * Every image this scene can switch to. They are kept mounted so changing
   * `image` crossfades between them.
   */
  scenes?: readonly string[];
  /** Tailwind object-position classes that keep the subject in frame. */
  imagePosition?: string;
  tone?: GatewayTone;
  panelProps?: HTMLAttributes<HTMLElement>;
  children: ReactNode;
}) {
  const isError = tone === 'error';
  const sceneImages = scenes.includes(image) ? scenes : [...scenes, image];
  const { className: panelClassName, ...restPanelProps } = panelProps ?? {};

  return (
    <main className="relative isolate flex min-h-screen items-end overflow-hidden bg-dss-navy-950 text-white sm:items-center">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {/* On wide screens the image fades into the navy backdrop on its left edge. */}
        <div className="absolute inset-0 lg:left-auto lg:w-[50%] lg:mask-[linear-gradient(to_right,transparent,#000_38%)]">
          {/* Every scene stays mounted (and preloaded) so a state change is a
              slow crossfade instead of a cut. */}
          <div className="gateway-drift absolute inset-0">
            {sceneImages.map((src) => {
              const isActive = src === image;
              return (
                <img
                  key={src}
                  src={src}
                  alt=""
                  decoding="async"
                  className={`absolute inset-0 size-full object-cover transition-[opacity,filter,transform] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${imagePosition} ${isActive ? 'scale-100 opacity-100 blur-0' : 'scale-[1.03] opacity-0 blur-sm'}`}
                />
              );
            })}
          </div>
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-dss-navy-950 via-dss-navy-950/55 to-dss-navy-950/10 lg:bg-linear-to-r lg:from-dss-navy-950 lg:from-36% lg:via-dss-navy-950/60 lg:via-55% lg:to-transparent" />
        <div className="absolute -left-40 top-1/4 size-144 rounded-full bg-dss-blue-700/25 blur-[120px]" />
        <div
          className={`gateway-glow absolute left-[10%] top-1/3 size-88 rounded-full blur-[110px] transition-colors duration-1000 ${isError ? 'bg-dss-red-500/25' : 'bg-dss-cyan-500/20'}`}
        />
      </div>

      <section
        {...restPanelProps}
        className={`gateway-rise relative mx-4 mb-6 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/6 p-6 shadow-[0_30px_80px_-20px_rgba(6,11,20,0.9)] backdrop-blur-2xl backdrop-saturate-150 sm:mx-auto sm:mb-0 sm:p-8 lg:ml-[8vw]${panelClassName ? ` ${panelClassName}` : ''}`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent to-transparent ${isError ? 'via-dss-red-500/70' : 'via-dss-cyan-400/70'}`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br from-white/8 via-transparent to-transparent"
        />
        <div className="relative">{children}</div>
      </section>
    </main>
  );
}

/** Small mono label that opens every gateway panel. */
export function GatewayEyebrow({
  children = 'DSS · Acceso',
}: {
  children?: ReactNode;
}) {
  return (
    <span className="font-mono text-[0.7rem] tracking-[0.18em] text-white/50 uppercase">
      {children}
    </span>
  );
}
