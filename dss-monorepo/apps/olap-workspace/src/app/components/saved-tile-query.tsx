'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
  executeSavedTileQuery,
  type AiQueryCell,
  type AiQueryResponse,
} from '@dss-monorepo/olap-data-access';
import { CellsetTable } from '@dss-monorepo/design-system';
import { SaikuChart, isChartType } from '@dss-monorepo/charts';
import type { ChartOptions } from '@dss-monorepo/charts';
import type {
  DashboardFilter,
  DashboardTile,
} from '@dss-monorepo/olap-data-access';
import type { CellEntry, QueryResult } from '@dss-monorepo/olap-models';

const EMPTY_FILTERS: readonly DashboardFilter[] = [];

export function SavedTileQuery({
  tile,
  filters = EMPTY_FILTERS,
}: {
  tile: DashboardTile;
  filters?: readonly DashboardFilter[];
}) {
  const [result, setResult] = useState<AiQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const query = tile.query;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void executeSavedTileQuery(query, filters)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Error al ejecutar la consulta.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, filters, query]);

  const view = useMemo(() => (result ? projectResult(result) : null), [result]);
  if (loading) {
    return (
      <div
        className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        Ejecutando consulta OLAP…
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="flex min-h-32 items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
        role="alert"
      >
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-destructive"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">No se pudo cargar este bloque</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {error}
          </p>
          <button
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" className="size-3" /> Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!view || view.rowCount === 0) {
    return (
      <p
        className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        La consulta no devolvió filas.
      </p>
    );
  }

  if (tile.type === 'chart' && isChartType(tile.chartType ?? 'bar')) {
    return (
      <SaikuChart
        chartType={
          (tile.chartType ?? 'bar') as Parameters<
            typeof SaikuChart
          >[0]['chartType']
        }
        projection={view.projection}
        options={tile.chartOptions as Partial<ChartOptions> | undefined}
        geometry={{ compact: true }}
        height="100%"
        ariaLabel={tile.title ?? 'Gráfico OLAP'}
      />
    );
  }

  if (tile.type === 'kpi') {
    const value = view.firstMeasure;
    return (
      <div className="flex h-full min-h-32 flex-col justify-center px-4">
        <p className="text-3xl font-semibold tabular-nums text-foreground">
          {value?.formatted ?? '—'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {view.projection.columnCategories[0] ?? 'Resultado'}
        </p>
      </div>
    );
  }

  return <CellsetTable result={view.table} maxHeight="100%" />;
}

function projectResult(response: AiQueryResponse) {
  const records = response.data ?? [];
  const rowFields = response.metadata?.rows ?? [];
  const measures = response.metadata?.measures ?? [];
  const getRecordValue = (
    record: Record<string, AiQueryCell | string>,
    key: string,
  ) => record[key];
  const rowCategories = records.map((record) =>
    rowFields
      .map((field) => {
        const value =
          getRecordValue(record, field.caption) ??
          getRecordValue(record, field.name);
        return typeof value === 'string' ? value : '';
      })
      .filter(Boolean)
      .join(' / '),
  );
  const matrix = records.map((record) =>
    measures.map((measure) => {
      const value = getRecordValue(record, measure);
      if (!value || typeof value !== 'object') return null;
      return typeof value.value === 'number' ? value.value : null;
    }),
  );
  const projection = {
    rowCategories,
    columnCategories: measures,
    matrix,
  };
  const header: CellEntry[] = [
    ...rowFields.map((field) => ({
      value: field.caption || field.name,
      type: 'ROW_HEADER_HEADER' as const,
    })),
    ...measures.map((measure) => ({
      value: measure,
      type: 'COLUMN_HEADER' as const,
    })),
  ];
  const body: CellEntry[][] = records.map((record): CellEntry[] => [
    ...rowFields.map((field) => {
      const value =
        getRecordValue(record, field.caption) ??
        getRecordValue(record, field.name);
      return {
        value: typeof value === 'string' ? value : '',
        type: 'ROW_HEADER' as const,
      };
    }),
    ...measures.map((measure) => {
      const value = getRecordValue(record, measure);
      return {
        value:
          value && typeof value === 'object'
            ? value.formatted
            : typeof value === 'string'
              ? value
              : '',
        type: 'DATA_CELL' as const,
      };
    }),
  ]);
  const table: QueryResult = { cellset: [header, ...body] };
  const firstMeasureValue =
    records[0] && measures[0] ? records[0][measures[0]] : undefined;
  return {
    projection,
    table,
    rowCount: records.length,
    firstMeasure:
      firstMeasureValue && typeof firstMeasureValue === 'object'
        ? firstMeasureValue
        : null,
  };
}
