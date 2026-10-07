'use client';

import * as React from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Grip,
  MoreHorizontal,
  RotateCw,
} from 'lucide-react';
import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';
import { Skeleton } from '../../atoms/skeleton';
import { cn } from 'cn';
import {
  DashboardEditContext,
  type DashboardMoveDirection,
} from './dashboard-edit-context';

export interface TileAction {
  label: string;
  onClick: () => void;
}

export interface TileProps {
  id: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  children?: React.ReactNode;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyMessage?: string;
  editMode?: boolean;
  actions?: readonly TileAction[];
  onRetry?: () => void;
  className?: string;
}

/** A dashboard panel with clear status, optional editing affordances, and recoverable states. */
export function Tile({
  id,
  title,
  subtitle,
  statusLabel,
  children,
  loading = false,
  error,
  empty = false,
  emptyMessage = 'Todavía no hay datos para mostrar.',
  editMode = false,
  actions = [],
  onRetry,
  className,
}: TileProps) {
  const titleId = React.useId();
  const editContext = React.useContext(DashboardEditContext);
  const showEditControls = editMode || editContext.showDragHandle;
  return (
    <section
      aria-labelledby={titleId}
      data-dashboard-tile={id}
      className={cn(
        'flex h-full min-h-40 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground',
        className,
      )}
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {showEditControls && (
            <span
              className="dashboard-grid-drag-handle cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
              role="img"
              aria-label={`Mover ${title}`}
              title="Arrastra para mover esta tarjeta"
            >
              <Grip aria-hidden="true" className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-sm font-semibold">
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusLabel && <Badge variant="secondary">{statusLabel}</Badge>}
          {(actions.length > 0 || editContext.moveTile) && (
            <details className="group relative">
              <summary
                className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Más acciones para ${title}`}
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </summary>
              <div className="absolute right-0 z-10 mt-1 grid min-w-40 gap-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                {editContext.moveTile && (
                  <div
                    className="grid grid-cols-4 gap-1 border-b border-border p-1"
                    aria-label={`Mover ${title} con los controles`}
                  >
                    {(
                      [
                        ['left', ArrowLeft, 'izquierda'],
                        ['up', ArrowUp, 'arriba'],
                        ['down', ArrowDown, 'abajo'],
                        ['right', ArrowRight, 'derecha'],
                      ] as const
                    ).map(([direction, Icon, label]) => (
                      <button
                        key={direction}
                        type="button"
                        aria-label={`Mover ${title} hacia ${label}`}
                        title={`Mover hacia ${label}`}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(event) => {
                          editContext.moveTile?.(
                            direction as DashboardMoveDirection,
                          );
                          event.currentTarget
                            .closest('details')
                            ?.removeAttribute('open');
                        }}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </button>
                    ))}
                  </div>
                )}
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      action.onClick();
                      event.currentTarget
                        .closest('details')
                        ?.removeAttribute('open');
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 p-4" aria-busy={loading}>
        {loading ? (
          <div className="space-y-3" aria-label={`Cargando ${title}`}>
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex min-h-24 flex-col items-center justify-center gap-2 text-center"
          >
            <AlertCircle
              aria-hidden="true"
              className="size-5 text-destructive"
            />
            <p className="text-sm text-muted-foreground">{error}</p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                <RotateCw aria-hidden="true" />
                Reintentar
              </Button>
            )}
          </div>
        ) : empty ? (
          <p className="flex min-h-24 items-center justify-center text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
