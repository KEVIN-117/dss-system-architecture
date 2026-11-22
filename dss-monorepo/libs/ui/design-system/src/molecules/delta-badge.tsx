import { cn } from 'cn';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export type DeltaUnit = 'pp' | '%' | 'pts' | (string & {});

export interface DeltaBadgeProps {
  /** Signed change versus the comparison period. `null` = no comparison. */
  value: number | null | undefined;
  unit: DeltaUnit;
  /** Which direction is good news. `none` keeps the badge neutral. */
  goodWhen?: 'up' | 'down' | 'none';
  /** Changes smaller than this count as "no change". */
  epsilon?: number;
  fractionDigits?: number;
  /** Spoken after the change, e.g. "frente a la gestión anterior". */
  comparisonLabel?: string;
  className?: string;
}

const SPOKEN_UNIT: Record<string, string> = {
  pp: 'puntos porcentuales',
  '%': 'por ciento',
  pts: 'puntos',
};

const TONE = {
  good: 'bg-success/12 text-success',
  bad: 'bg-destructive/12 text-destructive',
  neutral: 'bg-(--glass-track) text-muted-foreground',
} as const;

/**
 * Change indicator for KPIs. Direction is carried by an arrow, a sign and words,
 * so colour is never the only signal (WCAG 1.4.1).
 */
export function DeltaBadge({
  value,
  unit,
  goodWhen = 'up',
  epsilon = 0.05,
  fractionDigits = 1,
  comparisonLabel = 'frente a la gestión anterior',
  className,
}: DeltaBadgeProps) {
  const base =
    'inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-xs font-medium whitespace-nowrap tabular-nums';

  if (value == null || !Number.isFinite(value)) {
    return (
      <span className={cn(base, TONE.neutral, 'pl-2', className)}>
        Sin comparación
      </span>
    );
  }

  const direction =
    Math.abs(value) < epsilon ? 'flat' : value > 0 ? 'up' : 'down';
  const tone =
    direction === 'flat' || goodWhen === 'none'
      ? 'neutral'
      : direction === goodWhen
        ? 'good'
        : 'bad';

  const magnitude = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(value));
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '±';
  const visible = `${sign}${magnitude} ${unit}`;
  const verb =
    direction === 'up' ? 'Sube' : direction === 'down' ? 'Baja' : 'Sin cambio';
  const spoken =
    direction === 'flat'
      ? `${verb} ${comparisonLabel}`
      : `${verb} ${magnitude} ${SPOKEN_UNIT[unit] ?? unit} ${comparisonLabel}`;
  const Icon =
    direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <span
      data-slot="delta-badge"
      data-direction={direction}
      data-tone={tone}
      className={cn(base, TONE[tone], className)}
    >
      <Icon className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
      <span aria-hidden="true">{visible}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
