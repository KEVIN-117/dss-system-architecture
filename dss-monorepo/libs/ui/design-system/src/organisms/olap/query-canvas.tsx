'use client';

import {
  ArrowDownAZ,
  ArrowRightLeft,
  ArrowUpDown,
  Check,
  EyeOff,
  Filter,
  LayoutList,
  ListFilter,
  Rows3,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { AxisLocation } from '@dss-monorepo/olap-models';
import { Button } from '../../atoms/button';
import { Select } from '../../atoms/select';
import {
  OLAP_AXIS_DESCRIPTIONS,
  OLAP_AXIS_LABELS,
  OLAP_AXIS_ORDER,
  type OlapQueryAxes,
  type OlapQueryItem,
} from './types';

export interface QueryCanvasProps {
  axes: OlapQueryAxes;
  onRemoveItem: (item: OlapQueryItem, axis: AxisLocation) => void;
  onMoveItem: (
    item: OlapQueryItem,
    from: AxisLocation,
    to: AxisLocation,
  ) => void;
  onClearAxis?: (axis: AxisLocation) => void;
  onSwapAxes?: () => void;
  nonEmpty?: boolean;
  onToggleNonEmpty?: (nonEmpty: boolean) => void;
  onOpenOrderModal?: (axis: AxisLocation) => void;
  onOpenLimitModal?: (axis: AxisLocation) => void;
  onOpenFilterModal?: (axis: AxisLocation) => void;
  className?: string;
}

const axisIcons = {
  FILTER: Filter,
  COLUMNS: LayoutList,
  ROWS: Rows3,
  PAGES: ArrowRightLeft,
} satisfies Record<AxisLocation, typeof Filter>;

/** Four OLAP query axes with accessible controls for swapping, sorting, filtering, and organizing fields. */
export function QueryCanvas({
  axes,
  onRemoveItem,
  onMoveItem,
  onClearAxis,
  onSwapAxes,
  nonEmpty = false,
  onToggleNonEmpty,
  onOpenOrderModal,
  onOpenLimitModal,
  onOpenFilterModal,
  className,
}: QueryCanvasProps) {
  return (
    <section className={className} aria-labelledby="olap-query-canvas-heading">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="olap-query-canvas-heading"
            className="text-sm font-semibold text-foreground"
          >
            Diseño de consulta
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Organiza los campos en cada eje OLAP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSwapAxes && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSwapAxes}
              title="Invertir filas y columnas"
              className="h-8 gap-1.5 text-xs"
            >
              <ArrowUpDown aria-hidden="true" className="size-3.5" />
              <span>Invertir ejes</span>
            </Button>
          )}

          {onToggleNonEmpty && (
            <Button
              type="button"
              variant={nonEmpty ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onToggleNonEmpty(!nonEmpty)}
              title="Ocultar filas y columnas sin valores"
              className="h-8 gap-1.5 text-xs"
            >
              <EyeOff aria-hidden="true" className="size-3.5" />
              <span>Ocultar vacíos</span>
              {nonEmpty && <Check aria-hidden="true" className="size-3 text-primary" />}
            </Button>
          )}

          <span
            className="rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground"
            aria-label={`${OLAP_AXIS_ORDER.reduce((total, axis) => total + axes[axis].length, 0)} campos en la consulta`}
          >
            {OLAP_AXIS_ORDER.reduce(
              (total, axis) => total + axes[axis].length,
              0,
            )}{' '}
            campos
          </span>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {OLAP_AXIS_ORDER.map((axis) => {
          const Icon = axisIcons[axis];
          const items = axes[axis];
          const isRowOrCol = axis === 'ROWS' || axis === 'COLUMNS';

          return (
            <section
              key={axis}
              className="min-w-0 rounded-lg border border-border bg-background"
              aria-labelledby={`olap-axis-${axis.toLowerCase()}-heading`}
            >
              <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2">
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  <div className="min-w-0">
                    <h3
                      id={`olap-axis-${axis.toLowerCase()}-heading`}
                      className="text-sm font-medium text-foreground"
                    >
                      {OLAP_AXIS_LABELS[axis]}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({items.length})
                      </span>
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {OLAP_AXIS_DESCRIPTIONS[axis]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isRowOrCol && onOpenOrderModal && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Ordenar eje ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
                      title="Ordenar eje"
                      onClick={() => onOpenOrderModal(axis)}
                    >
                      <ArrowDownAZ aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}

                  {isRowOrCol && onOpenLimitModal && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Limitar eje ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
                      title="Limitar cantidad (Top/Bottom)"
                      onClick={() => onOpenLimitModal(axis)}
                    >
                      <ListFilter aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}

                  {onOpenFilterModal && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Filtro avanzado para ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
                      title="Filtro de expresión MDX"
                      onClick={() => onOpenFilterModal(axis)}
                    >
                      <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}

                  {items.length > 0 && onClearAxis && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Vaciar eje ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
                      title="Vaciar eje"
                      onClick={() => onClearAxis(axis)}
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}
                </div>
              </header>
              {items.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  Agrega dimensiones o medidas para completar este eje.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex min-w-0 items-center gap-2 px-3 py-2"
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-sm text-foreground"
                        title={item.label}
                      >
                        {item.label}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                        {item.kind}
                      </span>
                      <Select
                        aria-label={`Mover ${item.label} desde ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
                        value={axis}
                        className="h-7 w-28 py-0 pl-2 pr-6 text-xs"
                        data-testid={`move-${item.id}`}
                        onChange={(event) => {
                          const nextAxis = event.target.value as AxisLocation;
                          if (nextAxis !== axis)
                            onMoveItem(item, axis, nextAxis);
                        }}
                      >
                        {OLAP_AXIS_ORDER.map((option) => (
                          <option key={option} value={option}>
                            {OLAP_AXIS_LABELS[option]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Quitar ${item.label} de ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
                        onClick={() => onRemoveItem(item, axis)}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
