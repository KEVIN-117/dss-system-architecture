import * as React from 'react';
import { cn } from 'cn';
import { Card } from './card';
import {
  ChartSkeleton,
  EmptyState,
  RefreshIndicator,
  StatusBanner,
} from './feedback';

export interface ChartFrameProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Controls in the card header (toggles, selects). */
  actions?: React.ReactNode;
  /** Height reserved for the chart, also used by the skeleton. */
  height?: number;
  loading?: boolean;
  refreshing?: boolean;
  /** Shown instead of the chart; the rest of the page keeps working. */
  error?: { title?: string; message: React.ReactNode; onRetry?: () => void };
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: { title: React.ReactNode; description?: React.ReactNode };
  /** Usually a lazily loaded chart (next/dynamic). */
  children?: React.ReactNode;
}

/**
 * Card that owns a chart's loading, refreshing, error and empty states, so
 * every chart in the portals behaves the same way.
 */
export function ChartFrame({
  title,
  description,
  actions,
  height = 280,
  loading = false,
  refreshing = false,
  error,
  empty,
  children,
  className,
  ...props
}: ChartFrameProps) {
  const headingId = React.useId();
  return (
    <Card
      data-reveal
      data-slot="chart-frame"
      aria-labelledby={headingId}
      aria-busy={loading || refreshing || undefined}
      className={cn('gap-4 px-5 py-5 sm:px-6', className)}
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
    >
      <RefreshIndicator active={refreshing} />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 id={headingId} className="font-heading text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {loading ? (
        <ChartSkeleton height={height} />
      ) : error ? (
        <StatusBanner
          title={error.title ?? 'No se pudo cargar el gráfico'}
          description={error.message}
          onRetry={error.onRetry}
        />
      ) : empty ? (
        <EmptyState title={empty.title} description={empty.description} size="compact" />
      ) : (
        <div
          className={cn(
            'min-w-0 transition-opacity duration-(--dur-base)',
            refreshing && 'pointer-events-none opacity-60',
          )}
          style={{ minHeight: height }}
        >
          {children}
        </div>
      )}
    </Card>
  );
}
