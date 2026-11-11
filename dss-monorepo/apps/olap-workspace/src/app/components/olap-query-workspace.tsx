'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Code2,
  Download,
  ExternalLink,
  Play,
  RotateCcw,
  Sparkles,
  Table2,
} from 'lucide-react';
import { useAuth } from '@dss-monorepo/auth';
import {
  Button,
  CellsetTable,
  CubePicker,
  DimensionList,
  DrillthroughResultModal,
  FilterModal,
  LimitModal,
  MDXModal,
  MemberSelectionModal,
  OrderModal,
  QueryCanvas,
  Select,
  type DrillthroughResult,
  type MemberOption,
  type OlapMeasureOption,
  type OlapQueryAxes,
  type OlapQueryItem,
  type SortFunction,
} from '@dss-monorepo/design-system';
import {
  drillthrough,
  executeQuery,
  getCubeMetadata,
  getLevelMembers,
  getQueryMdx,
  listOlapConnections,
  newQuery,
} from '@dss-monorepo/olap-data-access';
import {
  parseCellset,
  toNumber,
  type AxisLocation,
  type CellEntry,
  type QueryResult,
  type SaikuConnection,
  type SaikuCube,
  type SaikuDimension,
  type SaikuMeasure,
  type ThinQuery,
} from '@dss-monorepo/olap-models';
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
  const [nonEmpty, setNonEmpty] = useState(true);

  // MDX Modal state
  const [mdxModalOpen, setMdxModalOpen] = useState(false);
  const [activeMdx, setActiveMdx] = useState('');

  // Drillthrough state
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillResult, setDrillResult] = useState<DrillthroughResult | null>(null);

  // Order modal state
  const [orderModalAxis, setOrderModalAxis] = useState<AxisLocation | null>(null);

  // Limit modal state
  const [limitModalAxis, setLimitModalAxis] = useState<AxisLocation | null>(null);

  // Filter modal state
  const [filterModalAxis, setFilterModalAxis] = useState<AxisLocation | null>(null);

  // Member selection modal state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberModalConfig, setMemberModalConfig] = useState<{
    dimensionUniqueName: string;
    hierarchyUniqueName: string;
    levelUniqueName?: string;
    caption: string;
  } | null>(null);
  const [levelMembers, setLevelMembers] = useState<MemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

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
    const initialQ = newQuery(cube);
    if (initialQ.queryModel) {
      initialQ.queryModel.axes.COLUMNS.nonEmpty = nonEmpty;
      initialQ.queryModel.axes.ROWS.nonEmpty = nonEmpty;
    }
    setQuery(initialQ);
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
  }, [cube, user?.username, nonEmpty]);

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

  const clearAxis = useCallback(
    (axis: AxisLocation) => {
      if (!query?.queryModel) return;
      const next = structuredClone(query);
      next.queryModel!.axes[axis].hierarchies = [];
      if (axis === 'COLUMNS') next.queryModel!.details.measures = [];
      setQuery(next);
    },
    [query],
  );

  const swapAxes = useCallback(() => {
    if (!query?.queryModel) return;
    const next = structuredClone(query);
    const colHierarchies = next.queryModel.axes.COLUMNS.hierarchies;
    const rowHierarchies = next.queryModel.axes.ROWS.hierarchies;
    next.queryModel.axes.COLUMNS.hierarchies = rowHierarchies;
    next.queryModel.axes.ROWS.hierarchies = colHierarchies;
    setQuery(next);
  }, [query]);

  const toggleNonEmpty = useCallback(
    (value: boolean) => {
      setNonEmpty(value);
      if (!query?.queryModel) return;
      const next = structuredClone(query);
      next.queryModel.axes.COLUMNS.nonEmpty = value;
      next.queryModel.axes.ROWS.nonEmpty = value;
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

  // Drillthrough execution
  const handleDrillthrough = async (
    cell: CellEntry,
    position?: string,
  ) => {
    const targetQueryName = result?.query?.name || query?.name;
    if (!targetQueryName) return;
    setDrillLoading(true);
    setDrillOpen(true);
    try {
      const pos = position || cell.properties?.position;
      const drillResponse = await drillthrough(targetQueryName, {
        position: pos,
        maxRows: 500,
      });
      if (drillResponse.error) throw new Error(drillResponse.error);

      const cellRows = drillResponse.cellset ?? [];
      if (cellRows.length === 0) {
        setDrillResult({ columns: [], rows: [] });
      } else {
        const columns = cellRows[0].map((c) => c.value || 'Columna');
        const rows = cellRows.slice(1).map((r) => r.map((c) => c.value));
        setDrillResult({
          columns,
          rows,
          runtimeMs: drillResponse.runtime,
        });
      }
    } catch (err) {
      setDrillResult({
        columns: [],
        rows: [],
        error: err instanceof Error ? err.message : 'Error en consulta drillthrough',
      });
    } finally {
      setDrillLoading(false);
    }
  };

  // MDX Modal handler
  const handleOpenMdxModal = async () => {
    if (!query) return;
    try {
      const mdx = await getQueryMdx(query.name);
      setActiveMdx(mdx || query.mdx || '/* MDX no disponible */');
      setMdxModalOpen(true);
    } catch {
      setActiveMdx(query.mdx || '/* Error al obtener MDX */');
      setMdxModalOpen(true);
    }
  };

  // Member selection modal handler
  const handleOpenMemberFilter = async (
    dimensionUniqueName: string,
    hierarchyUniqueName: string,
    levelUniqueName?: string,
    caption?: string,
  ) => {
    if (!cube || !user?.username) return;
    setMemberModalConfig({
      dimensionUniqueName,
      hierarchyUniqueName,
      levelUniqueName,
      caption: caption || hierarchyUniqueName,
    });
    setMemberModalOpen(true);
    setMembersLoading(true);
    try {
      const dim = metadata.dimensions.find((d) => d.uniqueName === dimensionUniqueName);
      const hier = dim?.hierarchies.find((h) => h.uniqueName === hierarchyUniqueName);
      const lvl = levelUniqueName
        ? hier?.levels?.find((l) => l.uniqueName === levelUniqueName)
        : hier?.levels?.[0];

      if (dim && hier && lvl) {
        const fetched = await getLevelMembers(
          user.username,
          cube,
          dim.name,
          hier.name,
          lvl.name,
        );
        setLevelMembers(
          fetched.map((f) => ({
            name: f.name,
            uniqueName: f.uniqueName,
            caption: f.caption || f.name,
          })),
        );
      } else {
        setLevelMembers([]);
      }
    } catch {
      setLevelMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleApplyMemberSelection = (
    selected: string[],
    selectionType: 'INCLUSION' | 'EXCLUSION',
  ) => {
    if (!query?.queryModel || !memberModalConfig) return;
    const next = structuredClone(query);
    const model = next.queryModel;
    const { hierarchyUniqueName, levelUniqueName } = memberModalConfig;

    // Find in any axis (ROWS, COLUMNS, FILTER)
    for (const ax of Object.values(model.axes)) {
      const h = ax.hierarchies.find((candidate) => candidate.name === hierarchyUniqueName);
      if (h) {
        const lvlKey = levelUniqueName || Object.keys(h.levels)[0];
        if (lvlKey && h.levels[lvlKey]) {
          h.levels[lvlKey].selection = {
            type: selectionType,
            members: selected.map((uniqueName) => ({ uniqueName })),
          };
        }
      }
    }
    setQuery(next);
    setMemberModalOpen(false);
  };

  // CSV export
  const handleExportCsv = () => {
    if (!result?.cellset || result.cellset.length === 0) return;
    const lines = result.cellset.map((row) =>
      row
        .map((cell) => {
          const val = (cell.value ?? '').replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(','),
    );
    const csvContent = `\uFEFF${lines.join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saiku-analisis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const projection = useMemo(
    () => (result ? projectCellset(result) : null),
    [result],
  );

  const measureOptions: OlapMeasureOption[] = useMemo(
    () =>
      metadata.measures.map((m) => ({
        name: m.name,
        uniqueName: m.uniqueName,
        caption: m.caption || m.name,
      })),
    [metadata.measures],
  );

  return (
    <main className="space-y-6" aria-labelledby="olap-workspace-heading">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Análisis detallado
          </p>
          <h1
            id="olap-workspace-heading"
            className="mt-1 text-2xl font-semibold text-foreground tracking-tight"
          >
            Explorador OLAP
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Diseña consultas multidimensionales, filtra miembros, analiza celdas con drillthrough y visualiza gráficos dinámicos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {query && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenMdxModal}
              title="Ver la consulta MDX generada"
              className="h-9 gap-1.5 text-xs"
            >
              <Code2 className="size-4" aria-hidden="true" />
              <span>Ver MDX</span>
            </Button>
          )}
          <Button
            onClick={() => void runQuery()}
            disabled={!query || !metadata.dimensions.length || running}
            className="h-9 gap-2 text-xs font-medium"
          >
            <Play aria-hidden="true" className="size-4 fill-current" />
            {running ? 'Ejecutando…' : 'Ejecutar consulta'}
          </Button>
        </div>
      </header>

      {/* Cube Selector */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
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

      {/* Main Studio layout */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.6fr)]">
        {/* Left: Dimensions and Measures */}
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-xs">
          <DimensionList
            dimensions={metadata.dimensions}
            measures={metadata.measures}
            loading={loadingMetadata}
            error={undefined}
            onAddItem={addItem}
            onOpenMemberFilter={handleOpenMemberFilter}
          />
        </section>

        {/* Right: Query Canvas and Results */}
        <section className="min-w-0 space-y-5">
          {query && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <QueryCanvas
                axes={axes}
                onRemoveItem={removeItem}
                onMoveItem={moveItem}
                onClearAxis={clearAxis}
                onSwapAxes={swapAxes}
                nonEmpty={nonEmpty}
                onToggleNonEmpty={toggleNonEmpty}
                onOpenOrderModal={(axis) => setOrderModalAxis(axis)}
                onOpenLimitModal={(axis) => setLimitModalAxis(axis)}
                onOpenFilterModal={(axis) => setFilterModalAxis(axis)}
              />
            </div>
          )}

          {/* Results Container */}
          <div className="min-h-80 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <h2 className="font-semibold text-foreground text-base">Resultados</h2>
                <p className="text-xs text-muted-foreground">
                  {result
                    ? `${result.height ?? result.cellset.length} filas · ${result.runtime ?? 0} ms`
                    : 'Ejecuta la consulta para inspeccionar los datos.'}
                </p>
              </div>

              {result && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={resultView === 'table' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setResultView('table')}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Table2 aria-hidden="true" className="size-3.5" />
                    <span>Tabla</span>
                  </Button>
                  <Button
                    variant={resultView === 'chart' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setResultView('chart')}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Sparkles aria-hidden="true" className="size-3.5" />
                    <span>Gráfico</span>
                  </Button>

                  {resultView === 'chart' && (
                    <Select
                      aria-label="Tipo de gráfico"
                      value={chartType}
                      onChange={(event) => setChartType(event.target.value)}
                      className="h-8 w-44 py-0 pl-2 text-xs"
                    >
                      {['Bars', 'Lines', 'Proportional', 'Matrix', 'Points', 'Geo'].map((grp) => (
                        <optgroup key={grp} label={grp}>
                          {CHART_TYPES.filter((t) => t.group === grp).map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleExportCsv}
                    className="h-8 gap-1.5 text-xs"
                    title="Exportar a CSV"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    <span>CSV</span>
                  </Button>
                </div>
              )}
            </div>

            {resultView === 'chart' && projection ? (
              <SaikuChart
                chartType={chartType as Parameters<typeof SaikuChart>[0]['chartType']}
                projection={projection}
                height={460}
              />
            ) : (
              <CellsetTable
                result={result}
                loading={running}
                onDrillthrough={handleDrillthrough}
              />
            )}
          </div>
        </section>
      </div>

      {/* Drillthrough result dialog */}
      <DrillthroughResultModal
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        result={drillResult}
        loadingLabel={drillLoading ? 'Consultando registros transaccionales…' : undefined}
      />

      {/* MDX Query View Modal */}
      <MDXModal
        open={mdxModalOpen}
        onCancel={() => setMdxModalOpen(false)}
        mdx={activeMdx}
        onRun={(newMdx) => {
          setMdxModalOpen(false);
          if (query) {
            const next = structuredClone(query);
            next.type = 'MDX';
            next.mdx = newMdx;
            setQuery(next);
            void executeQuery(next).then(setResult);
          }
        }}
      />

      {/* Order Modal */}
      {orderModalAxis && query?.queryModel && (
        <OrderModal
          open={Boolean(orderModalAxis)}
          axis={orderModalAxis}
          measures={measureOptions}
          initialMeasure={query.queryModel.axes[orderModalAxis].sortEvaluationLiteral || ''}
          initialSort={(query.queryModel.axes[orderModalAxis].sortOrder as SortFunction) || 'ASC'}
          onCancel={() => setOrderModalAxis(null)}
          onSave={(expression, sort) => {
            const next = structuredClone(query);
            next.queryModel.axes[orderModalAxis].sortOrder = sort;
            next.queryModel.axes[orderModalAxis].sortEvaluationLiteral = expression;
            setQuery(next);
            setOrderModalAxis(null);
            void executeQuery(next).then(setResult);
          }}
        />
      )}

      {/* Limit Modal */}
      {limitModalAxis && query?.queryModel && (
        <LimitModal
          open={Boolean(limitModalAxis)}
          axis={limitModalAxis}
          initialCount={10}
          onCancel={() => setLimitModalAxis(null)}
          onSave={(countOrExpr) => {
            const next = structuredClone(query);
            next.queryModel.axes[limitModalAxis].filters = [
              { filterType: 'TopCount', count: parseInt(countOrExpr, 10) || 10 },
            ];
            setQuery(next);
            setLimitModalAxis(null);
            void executeQuery(next).then(setResult);
          }}
        />
      )}

      {/* Filter Modal */}
      {filterModalAxis && query?.queryModel && (
        <FilterModal
          open={Boolean(filterModalAxis)}
          axis={filterModalAxis}
          expression={query.queryModel.axes[filterModalAxis].mdx || ''}
          onCancel={() => setFilterModalAxis(null)}
          onSave={(expr) => {
            const next = structuredClone(query);
            next.queryModel.axes[filterModalAxis].mdx = expr;
            setQuery(next);
            setFilterModalAxis(null);
            void executeQuery(next).then(setResult);
          }}
        />
      )}

      {/* Member Selection Modal */}
      {memberModalConfig && (
        <MemberSelectionModal
          open={memberModalOpen}
          onCancel={() => setMemberModalOpen(false)}
          dimensionCaption={memberModalConfig.caption}
          hierarchyCaption={memberModalConfig.hierarchyUniqueName}
          levelCaption={memberModalConfig.levelUniqueName}
          members={levelMembers}
          loading={membersLoading}
          onApply={handleApplyMemberSelection}
        />
      )}
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
