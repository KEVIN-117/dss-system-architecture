'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Play, Table2 } from 'lucide-react';
import { useAuth } from '@dss-monorepo/auth';
import {
  DimensionList,
  CubePicker,
  QueryCanvas,
  CellsetTable,
  Button,
  Select,
} from '@dss-monorepo/design-system';
import {
  listOlapConnections,
  getCubeMetadata,
} from '@dss-monorepo/olap-data-access';
import { executeQuery, newQuery } from '@dss-monorepo/olap-connector';
import {
  parseCellset,
  toNumber,
  type AxisLocation,
  type QueryResult,
  type SaikuConnection,
  type SaikuCube,
  type SaikuDimension,
  type SaikuMeasure,
  type ThinQuery,
} from '@dss-monorepo/olap-models';
import type { OlapQueryAxes, OlapQueryItem } from '@dss-monorepo/design-system';
import { CHART_TYPES, SaikuChart } from '@dss-monorepo/charts';

export function OlapQueryWorkspace() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SaikuConnection[]>([]);
  const [metadata, setMetadata] = useState<{
    dimensions: SaikuDimension[];
    measures: SaikuMeasure[];
  }>({ dimensions: [], measures: [] });
  const [cube, setCube] = useState<SaikuCube | null>(null);
  const [query, setQuery] = useState<ThinQuery | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultView, setResultView] = useState<'table' | 'chart'>('table');
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    if (!user?.username) return;
    let active = true;
    setLoadingConnections(true);
    void listOlapConnections(user.username)
      .then((items) => {
        if (active) setConnections(items);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudieron cargar las conexiones OLAP.',
          );
      })
      .finally(() => {
        if (active) setLoadingConnections(false);
      });
    return () => {
      active = false;
    };
  }, [user?.username]);

  useEffect(() => {
    if (!cube || !user?.username) {
      setMetadata({ dimensions: [], measures: [] });
      setQuery(null);
      setResult(null);
      return;
    }
    let active = true;
    setLoadingMetadata(true);
    setError(null);
    setQuery(newQuery(cube));
    setResult(null);
    void getCubeMetadata(user.username, cube)
      .then((value) => {
        if (active) setMetadata(value);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudieron cargar las dimensiones del cubo.',
          );
      })
      .finally(() => {
        if (active) setLoadingMetadata(false);
      });
    return () => {
      active = false;
    };
  }, [cube, user?.username]);

  const axes = useMemo(() => queryToAxes(query), [query]);
  const addItem = useCallback(
    (item: OlapQueryItem, axis: 'COLUMNS' | 'ROWS') => {
      if (!query?.queryModel || !cube) return;
      const next = structuredClone(query);
      const model = next.queryModel!;
      if (item.kind === 'measure') {
        const measure = metadata.measures.find(
          (candidate) => candidate.uniqueName === item.id,
        );
        if (
          !measure ||
          model.details.measures.some(
            (current) => current.uniqueName === measure.uniqueName,
          )
        )
          return;
        model.details.measures.push({
          name: measure.name,
          uniqueName: measure.uniqueName,
          caption: measure.caption || measure.name,
          type: 'EXACT',
        });
      } else {
        const dimension = metadata.dimensions.find(
          (candidate) => candidate.uniqueName === item.dimensionUniqueName,
        );
        const hierarchy = dimension?.hierarchies.find(
          (candidate) => candidate.uniqueName === item.hierarchyUniqueName,
        );
        if (!dimension || !hierarchy) return;
        const level = item.levelUniqueName
          ? hierarchy.levels?.find(
              (candidate) => candidate.uniqueName === item.levelUniqueName,
            )
          : hierarchy.levels?.[0];
        const levelName = level?.name;
        if (!levelName) return;
        const target = model.axes[axis].hierarchies;
        const existing = target.find(
          (candidate) => candidate.name === hierarchy.uniqueName,
        );
        if (existing) existing.levels[levelName] = { name: levelName };
        else
          target.push({
            name: hierarchy.uniqueName,
            caption: hierarchy.caption || hierarchy.name,
            dimension: dimension.name,
            levels: { [levelName]: { name: levelName } },
            cmembers: {},
          });
      }
      setQuery(next);
    },
    [cube, metadata, query],
  );

  const removeItem = useCallback(
    (item: OlapQueryItem, axis: AxisLocation) => {
      if (!query?.queryModel) return;
      const next = structuredClone(query);
      if (item.kind === 'measure') {
        next.queryModel!.details.measures =
          next.queryModel!.details.measures.filter(
            (measure) => measure.uniqueName !== item.id,
          );
      } else {
        next.queryModel!.axes[axis].hierarchies = next.queryModel!.axes[
          axis
        ].hierarchies.filter(
          (hierarchy) => hierarchy.name !== item.hierarchyUniqueName,
        );
      }
      setQuery(next);
    },
    [query],
  );

  const moveItem = useCallback(
    (item: OlapQueryItem, from: AxisLocation, to: AxisLocation) => {
      if (!query?.queryModel || from === to || item.kind === 'measure') return;
      const next = structuredClone(query);
      const source = next.queryModel!.axes[from].hierarchies;
      const index = source.findIndex(
        (hierarchy) => hierarchy.name === item.hierarchyUniqueName,
      );
      if (index < 0) return;
      const [hierarchy] = source.splice(index, 1);
      next.queryModel!.axes[to].hierarchies.push(hierarchy);
      setQuery(next);
    },
    [query],
  );

  const runQuery = async () => {
    if (!query) return;
    setRunning(true);
    setError(null);
    try {
      const response = await executeQuery(query);
      if (response.error) throw new Error(response.error);
      setResult(response);
      setResultView('table');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo ejecutar la consulta.',
      );
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const projection = useMemo(
    () => (result ? projectCellset(result) : null),
    [result],
  );

  return (
    <main className="space-y-6" aria-labelledby="olap-workspace-heading">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Análisis detallado
          </p>
          <h1
            id="olap-workspace-heading"
            className="mt-1 text-2xl font-semibold"
          >
            Explorador OLAP
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Construye consultas sobre tus cubos, organiza dimensiones y ejecuta
            análisis directamente en Saiku.
          </p>
        </div>
        <Button
          onClick={() => void runQuery()}
          disabled={!query || !metadata.dimensions.length || running}
        >
          <Play aria-hidden="true" className="size-4" />
          {running ? 'Ejecutando…' : 'Ejecutar consulta'}
        </Button>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <CubePicker
          connections={connections}
          onCubeChange={setCube}
          loading={loadingConnections}
          error={error && !cube ? error : undefined}
          selectedCubeUniqueName={cube?.uniqueName}
        />
      </section>

      {error && cube && (
        <p
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.6fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4">
          <DimensionList
            dimensions={metadata.dimensions}
            measures={metadata.measures}
            loading={loadingMetadata}
            error={undefined}
            onAddItem={addItem}
          />
        </section>
        <section className="min-w-0 space-y-5">
          {query && (
            <div className="rounded-xl border border-border bg-card p-4">
              <QueryCanvas
                axes={axes}
                onRemoveItem={removeItem}
                onMoveItem={moveItem}
              />
            </div>
          )}
          <div className="min-h-80 rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Resultados</h2>
                <p className="text-xs text-muted-foreground">
                  {result
                    ? `${result.height ?? result.cellset.length} filas · ${result.runtime ?? 0} ms`
                    : 'Ejecuta la consulta para ver los datos.'}
                </p>
              </div>
              {result && (
                <div className="flex items-center gap-2">
                  <Button
                    variant={resultView === 'table' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setResultView('table')}
                  >
                    <Table2 aria-hidden="true" className="size-4" />
                    Tabla
                  </Button>
                  <Button
                    variant={resultView === 'chart' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setResultView('chart')}
                  >
                    Gráfico
                  </Button>
                  {resultView === 'chart' && (
                    <Select
                      aria-label="Tipo de gráfico"
                      value={chartType}
                      onChange={(event) => setChartType(event.target.value)}
                      className="w-36"
                    >
                      {CHART_TYPES.filter((type) => type.id !== 'map').map(
                        (type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ),
                      )}
                    </Select>
                  )}
                </div>
              )}
            </div>
            {resultView === 'chart' && projection ? (
              <SaikuChart
                chartType={
                  chartType as Parameters<typeof SaikuChart>[0]['chartType']
                }
                projection={projection}
                height={420}
              />
            ) : (
              <CellsetTable result={result} loading={running} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function queryToAxes(query: ThinQuery | null): OlapQueryAxes {
  const axes: OlapQueryAxes = { FILTER: [], COLUMNS: [], ROWS: [], PAGES: [] };
  if (!query?.queryModel) return axes;
  for (const axis of Object.keys(axes) as AxisLocation[]) {
    axes[axis] = query.queryModel.axes[axis].hierarchies.map((hierarchy) => ({
      id: hierarchy.name,
      label: hierarchy.caption || hierarchy.name,
      kind: 'hierarchy' as const,
      dimensionUniqueName: hierarchy.dimension,
      hierarchyUniqueName: hierarchy.name,
    }));
  }
  axes.COLUMNS = [
    ...query.queryModel.details.measures.map((measure) => ({
      id: measure.uniqueName,
      label: measure.caption || measure.name,
      kind: 'measure' as const,
    })),
    ...axes.COLUMNS,
  ];
  return axes;
}

function projectCellset(result: QueryResult) {
  const parsed = parseCellset(result);
  return {
    rowCategories: parsed.rowCategories.length
      ? parsed.rowCategories
      : parsed.dataRows.map((_, index) => String(index + 1)),
    columnCategories: parsed.columnCategories.length
      ? parsed.columnCategories
      : (parsed.dataRows[0] ?? []).map((_, index) => `Medida ${index + 1}`),
    matrix: parsed.dataRows.map((row) => row.map((cell) => toNumber(cell))),
  };
}
