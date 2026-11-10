import { GraduationCap } from 'lucide-react';
import { cn } from 'cn';

export interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

/** A status indicator for session checks and other indeterminate operations. */
export function Loader({
  text = 'Verificando sesión…',
  fullScreen = true,
  className,
}: LoaderProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center overflow-hidden bg-background p-6 text-foreground',
        fullScreen ? 'min-h-screen' : 'min-h-48',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-6">
        <div
          aria-hidden="true"
          className="relative flex size-24 items-center justify-center"
        >
          <div className="dss-loader-spin absolute inset-0 rounded-full border-[3px] border-primary/15 border-t-primary border-r-primary" />
          <div className="dss-loader-reverse absolute inset-2 rounded-full border-2 border-muted-foreground/20 border-b-muted-foreground border-l-muted-foreground" />
          <div className="dss-loader-pulse absolute inset-4 rounded-full border-2 border-primary/20" />
          <div className="dss-loader-float relative flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="dss-loader-text text-sm font-semibold tracking-wide text-foreground">
            {text}
          </p>
          <div aria-hidden="true" className="flex gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="dss-loader-dot block size-1.5 rounded-full bg-primary/60"
                style={{ animationDelay: `${dot * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
