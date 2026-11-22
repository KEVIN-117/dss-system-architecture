'use client';

import * as React from 'react';
import { cn } from 'cn';
import { Card } from './card';
import { DeltaBadge, type DeltaBadgeProps } from './delta-badge';
import { Skeleton } from '../atoms/skeleton';
import { useCountUp } from '../motion/use-count-up';

export interface KpiCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  label: string;
  value: number | null | undefined;
  format: (value: number) => string;
  icon?: React.ReactNode;
  delta?: DeltaBadgeProps;
  /** A small trend graphic, e.g. AcademicSparkline. Decorative to readers. */
  sparkline?: React.ReactNode;
  /** One line under the value, e.g. "9 183 de 11 240 evaluables". */
  detail?: React.ReactNode;
  /** Shown when the value is missing. */
  emptyLabel?: string;
  loading?: boolean;
  /** Dims the card while new data is on its way (stale-while-refresh). */
  refreshing?: boolean;
}

/**
 * KPI tile on the glass surface. Memoized so a filter change re-renders only
 * the tiles whose props changed; value changes tween with useCountUp.
 */
export const KpiCard = React.memo(function KpiCard({
  label,
  value,
  format,
  icon,
  delta,
  sparkline,
  detail,
  emptyLabel = 'Sin dato',
  loading = false,
  refreshing = false,
  className,
  ...props
}: KpiCardProps) {
  const valueRef = React.useRef<HTMLSpanElement>(null);
  const hasValue = value != null && Number.isFinite(value);
  useCountUp(valueRef, hasValue ? value : null, format);

  return (
    <Card
      data-reveal
      data-slot="kpi-card"
      aria-busy={loading || refreshing || undefined}
      className={cn('gap-3 px-5 py-5', className)}
      {...props}
    >
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground [&_svg]:size-4 [&_svg]:text-role-accent">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {label}
      </p>

      {loading ? (
        /* Same box as the value and the delta row: nothing jumps when data lands. */
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-3 transition-opacity duration-(--dur-base)',
            refreshing && 'opacity-60',
          )}
        >
          <p className="font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums">
            <span ref={valueRef} aria-hidden="true">
              {hasValue ? format(value) : '—'}
            </span>
            <span className="sr-only">{hasValue ? format(value) : emptyLabel}</span>
          </p>
          {delta || sparkline ? (
            <div className="flex min-h-7 items-end justify-between gap-2">
              {delta ? <DeltaBadge {...delta} /> : <span />}
              {sparkline ? (
                <span aria-hidden="true" className="shrink-0">
                  {sparkline}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </Card>
  );
});
