'use client';

import * as React from 'react';
import { Layers3, Plus, Search, TableProperties } from 'lucide-react';
import type { SaikuDimension, SaikuMeasure } from '@dss-monorepo/olap-models';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Loader } from '../../atoms/loader';
import { OLAP_AXIS_LABELS, type OlapQueryItem } from './types';

export interface DimensionListProps {
  dimensions: readonly SaikuDimension[];
  measures?: readonly SaikuMeasure[];
  onAddItem: (item: OlapQueryItem, axis: 'COLUMNS' | 'ROWS') => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

/** Searchable OLAP metadata browser. Dimensions default to rows and measures to columns. */
export function DimensionList({
  dimensions,
  measures = [],
  onAddItem,
  loading = false,
  error,
  className,
}: DimensionListProps) {
  const [search, setSearch] = React.useState('');
  const instanceId = React.useId();
  const dimensionsHeadingId = `${instanceId}-dimensions`;
  const measuresHeadingId = `${instanceId}-measures`;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredDimensions = React.useMemo(
    () =>
      dimensions
        .map((dimension) => ({
          dimension,
          hierarchies: dimension.hierarchies
            .filter((hierarchy) => {
              if (!normalizedSearch) return true;
              return (
                dimension.caption
                  .toLocaleLowerCase()
                  .includes(normalizedSearch) ||
                hierarchy.caption
                  .toLocaleLowerCase()
                  .includes(normalizedSearch) ||
                hierarchy.levels?.some((level) =>
                  level.caption.toLocaleLowerCase().includes(normalizedSearch),
                )
              );
            })
            .map((hierarchy) => ({
              hierarchy,
              levels: hierarchy.levels?.filter(
                (level) =>
                  !normalizedSearch ||
                  dimension.caption
                    .toLocaleLowerCase()
                    .includes(normalizedSearch) ||
                  hierarchy.caption
                    .toLocaleLowerCase()
                    .includes(normalizedSearch) ||
                  level.caption.toLocaleLowerCase().includes(normalizedSearch),
              ),
            })),
        }))
        .filter(
          ({ dimension, hierarchies }) =>
            hierarchies.length > 0 ||
            dimension.caption.toLocaleLowerCase().includes(normalizedSearch),
        ),
    [dimensions, normalizedSearch],
  );
  const filteredMeasures = measures.filter(
    (measure) =>
      !normalizedSearch ||
      measure.caption.toLocaleLowerCase().includes(normalizedSearch) ||
      measure.name.toLocaleLowerCase().includes(normalizedSearch),
  );

  return (
    <section
      className={className}
      aria-labelledby={dimensionsHeadingId}
      aria-busy={loading}
    >
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id={dimensionsHeadingId}
              className="text-sm font-semibold text-foreground"
            >
              Dimensiones y medidas
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Explora el cubo y agrega campos a la consulta.
            </p>
          </div>
          <span
            className="rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground"
            aria-label={`${dimensions.length} dimensiones y ${measures.length} medidas`}
          >
            {dimensions.length + measures.length}
          </span>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar campos"
            aria-label="Buscar dimensiones y medidas"
            className="pl-8"
          />
        </div>
      </header>

      {loading ? (
        <Loader text="Cargando dimensiones y medidas…" fullScreen={false} className="mt-4 rounded-lg" />
      ) : error ? (
        <p
          className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : dimensions.length === 0 && measures.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <Layers3
            aria-hidden="true"
            className="mx-auto size-5 text-muted-foreground"
          />
          <p className="mt-2 text-sm font-medium text-foreground">
            No hay campos disponibles
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona un cubo para cargar sus dimensiones y medidas.
          </p>
        </div>
      ) : filteredDimensions.length === 0 && filteredMeasures.length === 0 ? (
        <p
          className="mt-4 rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground"
          role="status"
        >
          No encontramos campos para “{search}”. Prueba con otro término.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {filteredDimensions.length > 0 && (
            <section aria-labelledby={`${instanceId}-dimension-group`}>
              <h3
                id={`${instanceId}-dimension-group`}
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Dimensiones
              </h3>
              <ul className="space-y-1">
                {filteredDimensions.map(({ dimension, hierarchies }) => (
                  <li key={dimension.uniqueName}>
                    <details className="group rounded-md border border-transparent open:border-border open:bg-background">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        <Layers3
                          aria-hidden="true"
                          className="size-4 shrink-0 text-primary"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {dimension.caption}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {hierarchies.length}
                        </span>
                      </summary>
                      <div className="space-y-3 px-2.5 pb-3 pt-1">
                        {hierarchies.map(({ hierarchy, levels }) => (
                          <div
                            key={hierarchy.uniqueName}
                            className="space-y-1 border-l border-border pl-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                                {hierarchy.caption}
                              </p>
                              <AddFieldButton
                                label={hierarchy.caption}
                                axis="ROWS"
                                onClick={() =>
                                  onAddItem(
                                    {
                                      id: hierarchy.uniqueName,
                                      label: hierarchy.caption,
                                      kind: 'hierarchy',
                                      dimensionUniqueName: dimension.uniqueName,
                                      hierarchyUniqueName: hierarchy.uniqueName,
                                    },
                                    'ROWS',
                                  )
                                }
                              />
                            </div>
                            {levels?.map((level) => (
                              <div
                                key={level.uniqueName}
                                className="flex items-center justify-between gap-2 rounded-sm py-0.5 pl-2"
                              >
                                <span className="min-w-0 truncate text-xs text-foreground">
                                  {level.caption}
                                </span>
                                <AddFieldButton
                                  label={level.caption}
                                  axis="ROWS"
                                  onClick={() =>
                                    onAddItem(
                                      {
                                        id: level.uniqueName,
                                        label: level.caption,
                                        kind: 'level',
                                        dimensionUniqueName:
                                          dimension.uniqueName,
                                        hierarchyUniqueName:
                                          hierarchy.uniqueName,
                                        levelUniqueName: level.uniqueName,
                                      },
                                      'ROWS',
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                        {hierarchies.length === 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              Sin jerarquías
                            </p>
                            <AddFieldButton
                              label={dimension.caption}
                              axis="ROWS"
                              onClick={() =>
                                onAddItem(
                                  {
                                    id: dimension.uniqueName,
                                    label: dimension.caption,
                                    kind: 'dimension',
                                    dimensionUniqueName: dimension.uniqueName,
                                  },
                                  'ROWS',
                                )
                              }
                            />
                          </div>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {filteredMeasures.length > 0 && (
            <section aria-labelledby={measuresHeadingId}>
              <h3
                id={measuresHeadingId}
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Medidas
              </h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {filteredMeasures.map((measure) => (
                  <li
                    key={measure.uniqueName}
                    className="flex items-center gap-2 px-2.5 py-1.5"
                  >
                    <TableProperties
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {measure.caption}
                    </span>
                    <AddFieldButton
                      label={measure.caption}
                      axis="COLUMNS"
                      onClick={() =>
                        onAddItem(
                          {
                            id: measure.uniqueName,
                            label: measure.caption,
                            kind: 'measure',
                          },
                          'COLUMNS',
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function AddFieldButton({
  label,
  axis,
  onClick,
}: {
  label: string;
  axis: 'COLUMNS' | 'ROWS';
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Agregar ${label} a ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
      title={`Agregar a ${OLAP_AXIS_LABELS[axis].toLocaleLowerCase()}`}
      onClick={onClick}
    >
      <Plus aria-hidden="true" />
    </Button>
  );
}
