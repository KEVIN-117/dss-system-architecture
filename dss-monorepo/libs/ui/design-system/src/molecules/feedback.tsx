import * as React from 'react';
import { cn } from 'cn';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  RotateCcw,
  SearchX,
  XCircle,
} from 'lucide-react';
import { Button } from '../atoms/button';
import { Skeleton } from '../atoms/skeleton';

/* -------------------------------------------------------------------------- */
/* StatusBanner                                                               */
/* -------------------------------------------------------------------------- */

const BANNER_TONE = {
  error: {
    icon: XCircle,
    className: 'border-destructive/40 bg-destructive/10 [&>svg]:text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning/40 bg-warning/12 [&>svg]:text-warning',
  },
  info: {
    icon: Info,
    className: 'border-info/30 bg-info/8 [&>svg]:text-info',
  },
} as const;

export interface StatusBannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: keyof typeof BANNER_TONE;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Shows a "Reintentar" button. */
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  action?: React.ReactNode;
}

/**
 * Says what failed and how to recover, scoped to the section it sits in, so
 * the rest of the page keeps working. Errors are announced (role="alert");
 * warnings and info are polite (role="status").
 */
export function StatusBanner({
  tone = 'error',
  title,
  description,
  onRetry,
  retryLabel = 'Reintentar',
  retrying = false,
  action,
  className,
  ...props
}: StatusBannerProps) {
  const { icon: Icon, className: toneClass } = BANNER_TONE[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-slot="status-banner"
      data-tone={tone}
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm text-foreground',
        toneClass,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-[1_1_16rem]">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mt-0.5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onRetry || action ? (
        <div className="flex items-center gap-2">
          {action}
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={retrying}
              iconLeft={<RotateCcw aria-hidden="true" />}
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* EmptyState                                                                 */
/* -------------------------------------------------------------------------- */

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  /** Why it's empty and what to do next. */
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  size?: 'default' | 'compact';
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  size = 'default',
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-1.5 text-center text-sm text-muted-foreground',
        size === 'default' ? 'px-4 py-10' : 'px-3 py-6',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="mb-2 grid size-11 place-items-center rounded-xl bg-role-accent/12 text-role-accent [&_svg]:size-5"
      >
        {icon ?? <SearchX />}
      </span>
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-[48ch]">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PaginationBar                                                              */
/* -------------------------------------------------------------------------- */

export interface PaginationBarProps extends React.HTMLAttributes<HTMLElement> {
  /** Zero-based page index. */
  page: number;
  pageSize: number;
  /** Total rows; when unknown, pass `hasNextPage` instead. */
  total?: number;
  hasNextPage?: boolean;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  hasNextPage,
  onPageChange,
  disabled = false,
  className,
  ...props
}: PaginationBarProps) {
  const format = new Intl.NumberFormat('es-BO');
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = total == null ? (page + 1) * pageSize : Math.min(total, (page + 1) * pageSize);
  const canNext = total == null ? Boolean(hasNextPage) : last < total;

  return (
    <nav
      aria-label="Paginación"
      data-slot="pagination-bar"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground',
        className,
      )}
      {...props}
    >
      <p role="status" className="tabular-nums">
        {total == null
          ? `Mostrando ${format.format(first)}–${format.format(last)}`
          : `Mostrando ${format.format(first)}–${format.format(last)} de ${format.format(total)}`}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page === 0}
          onClick={() => onPageChange(page - 1)}
          iconLeft={<ChevronLeft aria-hidden="true" />}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canNext}
          onClick={() => onPageChange(page + 1)}
          iconRight={<ChevronRight aria-hidden="true" />}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* RefreshIndicator and ChartSkeleton                                         */
/* -------------------------------------------------------------------------- */

export interface RefreshIndicatorProps {
  active: boolean;
  /** Announced politely while active. */
  label?: string;
  className?: string;
}

/**
 * A 2px gradient sweep along the top edge of the parent (which must be
 * positioned) while data refreshes. Existing content stays on screen.
 */
export function RefreshIndicator({
  active,
  label = 'Actualizando datos…',
  className,
}: RefreshIndicatorProps) {
  return (
    <>
      <span
        aria-hidden="true"
        data-slot="refresh-indicator"
        data-active={active}
        className={cn(
          'pointer-events-none absolute inset-x-4 top-0 h-0.5 overflow-hidden rounded-full opacity-0 transition-opacity duration-(--dur-fast) data-[active=true]:opacity-100',
          className,
        )}
      >
        {active ? (
          <span className="absolute inset-y-0 w-2/5 animate-ds-sweep bg-linear-to-r from-transparent via-dss-cyan-400 to-transparent" />
        ) : null}
      </span>
      <span role="status" className="sr-only">
        {active ? label : ''}
      </span>
    </>
  );
}

export interface ChartSkeletonProps {
  /** Must match the chart's real height so nothing shifts when it loads. */
  height?: number | string;
  className?: string;
  label?: string;
}

export function ChartSkeleton({
  height = 280,
  className,
  label = 'Cargando gráfico…',
}: ChartSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      data-slot="chart-skeleton"
      className={cn('flex w-full items-end gap-2', className)}
      style={{ height }}
    >
      {[48, 64, 40, 76, 58, 88, 70].map((size, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-md"
          style={{ height: `${size}%` }}
        />
      ))}
    </div>
  );
}
