'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Info,
  Loader2,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import type { Tone } from './etl-format';

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export const TONE_CLASS: Record<Tone, string> = {
  success: 'border-success/40 bg-success/10 text-success',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  running: 'border-primary/40 bg-primary/10 text-primary',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  neutral: 'border-border bg-muted/60 text-muted-foreground',
};

export const TONE_BAR: Record<Tone, string> = {
  success: 'bg-success',
  danger: 'bg-destructive',
  running: 'bg-primary',
  warning: 'bg-warning',
  neutral: 'bg-muted-foreground/40',
};

const TONE_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  danger: XCircle,
  running: Loader2,
  warning: MinusCircle,
  neutral: Circle,
};

/** Estado con icono y texto: nunca depende solo del color. */
export function StatusPill({
  tone,
  label,
  size = 'md',
  icon,
}: {
  tone: Tone;
  label: string;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
}) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONE_CLASS[tone],
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          size === 'sm' ? 'size-3.5' : 'size-4',
          tone === 'running' && !icon && 'motion-safe:animate-spin',
        )}
      />
      {label}
    </span>
  );
}

export function SeverityIcon({ tone }: { tone: Tone }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : Info;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg border',
            TONE_CLASS[tone],
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true));
      }}
      aria-label={copied ? 'Copiado' : label}
      title={copied ? 'Copiado' : label}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 text-success" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
    </button>
  );
}

/** Reloj que avanza cada segundo solo mientras `active` es verdadero. */
export function useNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

export function AutoRefreshSwitch({
  checked,
  onChange,
  seconds,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  seconds: number;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-4 rounded-full bg-background shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm text-muted-foreground">
        Actualizar cada {seconds} s
      </label>
    </div>
  );
}
