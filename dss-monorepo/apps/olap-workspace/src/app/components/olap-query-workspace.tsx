'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Code2,
  Download,
  Play,
  RefreshCw,
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
  deserializeQueryFromHash,
  serializeQueryToHash,
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
import {
  academicLabel,
  chartLabel,
  isUatfCube,
} from '../../lib/academic-labels';

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
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [metadataAttempt, setMetadataAttempt] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
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
  const [drillResult, setDrillResult] = useState<DrillthroughResult | null>(
    null,
  );

  // Order modal state
  const [orderModalAxis, setOrderModalAxis] = useState<AxisLocation | null>(
    null,
  );

  // Limit modal state
  const [limitModalAxis, setLimitModalAxis] = useState<AxisLocation | null>(
    null,
  );

  // Filter modal state
  const [filterModalAxis, setFilterModalAxis] = useState<AxisLocation | null>(
    null,
  );

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

  const [restoreParsed, setRestoreParsed] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    query: ThinQuery;
    viewMode: 'table' | 'chart';
    chartType?: string;
  } | null>(null);
  const [urlStateReady, setUrlStateReady] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('q');
    const restored = token ? deserializeQueryFromHash(token) : null;
    if (restored && isRestorableQuery(restored.query)) {
      setPendingRestore({
        query: restored.query,
        viewMode: restored.view.viewMode === 'chart' ? 'chart' : 'table',
        chartType: CHART_TYPES.some(
          (type) => type.id === restored.view.chartType,
        )
          ? restored.view.chartType
          : undefined,
      });
    }
    setRestoreParsed(true);
  }, []);

  useEffect(() => {
    if (!user?.username) return;
    let active = true;
    setLoadingConnections(true);
    setConnectionError(null);
    void listOlapConnections(user.username)
      .then((items) => {
        if (active) setConnections(items);
      })
      .catch((cause: unknown) => {
        if (active)
          setConnectionError(
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
  }, [connectionAttempt, user?.username]);

  useEffect(() => {
    if (
      !restoreParsed ||
      loadingConnections ||
      connectionError ||
      !pendingRestore ||
      cube
    )
      return;
    const restoredCube = connections
      .flatMap((connection) =>
        connection.catalogs.flatMap((catalog) =>
          catalog.schemas.flatMap((schema) => schema.cubes),
        ),
      )
      .find(
        (candidate) =>
          candidate.uniqueName === pendingRestore.query.cube.uniqueName,
      );
    if (restoredCube) {
      setCube(restoredCube);
      setResultView(pendingRestore.viewMode);
      if (pendingRestore.chartType) setChartType(pendingRestore.chartType);
    } else {
      setConnectionError(
        'El cubo del enlace no está disponible para tu sesión.',
      );
      setPendingRestore(null);
      setUrlStateReady(true);
    }
  }, [
    connectionError,
    connections,
    cube,
    loadingConnections,
    pendingRestore,
    restoreParsed,
  ]);

  useEffect(() => {
    if (!cube || !user?.username) {
      setMetadata({ dimensions: [], measures: [] });
      setQuery(null);
      setResult(null);
      return;
    }
    let active = true;
    setLoadingMetadata(true);
    setMetadataError(null);
    setError(null);
    setResult(null);
    void getCubeMetadata(user.username, cube)
      .then((value) => {
        if (active) {
          setMetadata(value);
          const restored = pendingRestore;
          if (
            restored &&
            restored.query.cube.uniqueName === cube.uniqueName &&
            isRestorableQuery(restored.query)
          ) {
            setQuery({ ...restored.query, cube });
            setResultView(restored.viewMode);
            if (restored.chartType) setChartType(restored.chartType);
          } else {
            const initialQ = newQuery(cube);
            if (initialQ.queryModel) {
              initialQ.queryModel.axes.COLUMNS.nonEmpty = nonEmpty;
              initialQ.queryModel.axes.ROWS.nonEmpty = nonEmpty;
            }
            setQuery(initialQ);
          }
          setUrlStateReady(true);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setMetadataError(
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
  }, [cube, metadataAttempt, nonEmpty, pendingRestore, user?.username]);

  useEffect(() => {
    if (!urlStateReady || !query) return;
    const url = new URL(window.location.href);
    url.searchParams.set(
      'q',
      serializeQueryToHash(query, { viewMode: resultView, chartType }),
    );
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [chartType, query, resultView, urlStateReady]);

  const axes = useMemo(() => queryToAxes(query), [query]);

  const displayConnections = useMemo(
    () =>
      connections.map((connection) => ({
        ...connection,
        catalogs: connection.catalogs.map((catalog) => ({
          ...catalog,
          schemas: catalog.schemas.map((schema) => ({
            ...schema,
            cubes: schema.cubes.map((item) =>
              isUatfCube(item)
                ? { ...item, caption: academicLabel(item.caption || item.name) }
                : item,
            ),
          })),
        })),
      })),
    [connections],
  );

  const displayMetadata = useMemo(() => {
    if (!isUatfCube(cube)) return metadata;
    return {
      dimensions: metadata.dimensions.map((dimension) => ({
        ...dimension,
        caption: academicLabel(dimension.caption || dimension.name),
        hierarchies: dimension.hierarchies.map((hierarchy) => ({
          ...hierarchy,
          caption: academicLabel(hierarchy.caption || hierarchy.name),
          levels: hierarchy.levels?.map((level) => ({
            ...level,
            caption: academicLabel(level.caption || level.name),
          })),
        })),
      })),
      measures: metadata.measures.map((measure) => ({
        ...measure,
        caption: academicLabel(measure.caption || measure.name),
      })),
    };
  }, [cube, metadata]);

  const displayResult = useMemo(() => {
    if (!result || !isUatfCube(cube)) return result;
    return {
      ...result,
      cellset: result.cellset.map((row) =>
        row.map((cell) => {
          const value = cell.value;
          if (
            !value ||
            (cell.type !== 'COLUMN_HEADER' &&
              cell.type !== 'ROW_HEADER' &&
              cell.type !== 'ROW_HEADER_HEADER')
          )
            return cell;
          if (
            cell.type === 'ROW_HEADER' &&
            value !== '(All)' &&
            !value.startsWith('All By ')
          )
            return cell;
          return { ...cell, value: academicLabel(value) };
        }),
      ),
    };
  }, [cube, result]);

  const addItem = useCallback(
    (item: OlapQueryItem, axis: 'COLUMNS' | 'ROWS') => {
      if (!query?.queryModel || !cube) return;
      const next = structuredClone(query);
      const model = next.queryModel;
      if (!model) return;
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
      const model = next.queryModel;
      if (!model) return;
      if (item.kind === 'measure') {
        model.details.measures = model.details.measures.filter(
          (measure) => measure.uniqueName !== item.id,
        );
      } else {
        model.axes[axis].hierarchies = model.axes[axis].hierarchies.filter(
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
      const model = next.queryModel;
      if (!model) return;
      const source = model.axes[from].hierarchies;
      const index = source.findIndex(
        (hierarchy) => hierarchy.name === item.hierarchyUniqueName,
      );
      if (index < 0) return;
      const [hierarchy] = source.splice(index, 1);
      if (!hierarchy) return;
      model.axes[to].hierarchies.push(hierarchy);
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
  const handleDrillthrough = async (cell: CellEntry, position?: string) => {
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
        error:
          err instanceof Error ? err.message : 'Error en consulta drillthrough',
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
      const dim = metadata.dimensions.find(
        (d) => d.uniqueName === dimensionUniqueName,
      );
      const hier = dim?.hierarchies.find(
        (h) => h.uniqueName === hierarchyUniqueName,
      );
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
      const h = ax.hierarchies.find(
        (candidate) => candidate.name === hierarchyUniqueName,
      );
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
    if (!displayResult?.cellset || displayResult.cellset.length === 0) return;
    const lines = displayResult.cellset.map((row) =>
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
    () => (displayResult ? projectCellset(displayResult) : null),
    [displayResult],
  );
  const selectCube = useCallback(
    (selectedCube: SaikuCube) => {
      setCube(selectedCube);
      if (selectedCube.uniqueName !== pendingRestore?.query.cube.uniqueName) {
        setPendingRestore(null);
      }
    },
    [pendingRestore],
  );

  const measureOptions: OlapMeasureOption[] = useMemo(
    () =>
      metadata.measures.map((m) => ({
        name: m.name,
        uniqueName: m.uniqueName,
        caption: isUatfCube(cube)
          ? academicLabel(m.caption || m.name)
          : m.caption || m.name,
      })),
    [cube, metadata.measures],
  );
  const selectedHierarchy = displayMetadata.dimensions
    .find(
      (dimension) =>
        dimension.uniqueName === memberModalConfig?.dimensionUniqueName,
    )
    ?.hierarchies.find(
      (hierarchy) =>
        hierarchy.uniqueName === memberModalConfig?.hierarchyUniqueName,
    );
  const selectedLevel =
    selectedHierarchy?.levels?.find(
      (level) => level.uniqueName === memberModalConfig?.levelUniqueName,
    ) ?? selectedHierarchy?.levels?.[0];

  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] flex-col"
      aria-labelledby="olap-workspace-heading"
    >
      {/* Main Studio layout */}
      <div className="grid min-w-0 flex-1 lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
        {/* Left: Dimensions and Measures */}
        <aside
          aria-label="Explorador de cubos"
          className="min-w-0 border-b border-border bg-card p-4 lg:sticky lg:top-0 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          <CubePicker
            connections={displayConnections}
            onCubeChange={selectCube}
            loading={loadingConnections}
            error={connectionError ?? undefined}
            selectedCubeUniqueName={cube?.uniqueName}
          />
          {cube ? (
            <div className="mt-5 border-t border-border pt-5">
              <DimensionList
                dimensions={displayMetadata.dimensions}
                measures={displayMetadata.measures}
                loading={loadingMetadata}
                error={metadataError ?? undefined}
                onAddItem={addItem}
                onOpenMemberFilter={handleOpenMemberFilter}
              />
              {metadataError && (
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => setMetadataAttempt((value) => value + 1)}
                  disabled={loadingMetadata}
                >
                  <RefreshCw aria-hidden="true" className="size-4" /> Reintentar
                  metadatos
                </Button>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Selecciona un cubo para explorar sus medidas y dimensiones.
            </p>
          )}
        </aside>

        {/* Right: Query Canvas and Results */}
        <section
          className="min-w-0 space-y-4 p-4 sm:p-6"
          aria-label="Área de consulta"
        >
          <header className="-mx-4 -mt-4 border-b border-border bg-card sm:-mx-6 sm:-mt-6">
            <div className="border-b border-border px-4 sm:px-6">
              <h1
                id="olap-workspace-heading"
                className="inline-flex min-h-10 items-center border-b-2 border-primary px-1 text-sm font-semibold text-foreground"
              >
                Consulta OLAP
              </h1>
            </div>
            <div className="flex min-h-12 flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
              <Button
                onClick={() => void runQuery()}
                disabled={
                  !query?.queryModel?.details.measures.length ||
                  running ||
                  loadingMetadata
                }
                className="min-h-9 gap-2"
                size="sm"
              >
                <Play aria-hidden="true" className="size-4 fill-current" />
                {running ? 'Ejecutando…' : 'Ejecutar consulta'}
              </Button>
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenMdxModal}
                  className="min-h-9 gap-2"
                >
                  <Code2 aria-hidden="true" className="size-4" />
                  Ver MDX
                </Button>
              )}
              <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                {cube
                  ? isUatfCube(cube)
                    ? academicLabel(cube.caption || cube.name)
                    : cube.caption || cube.name
                  : 'Selecciona un cubo para comenzar'}
              </span>
            </div>
          </header>
          {error && cube && (
            <div
              className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span className="min-w-0 flex-1">{error}</span>
              {result === null && !running && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void runQuery()}
                >
                  <RefreshCw aria-hidden="true" className="size-4" /> Reintentar
                </Button>
              )}
            </div>
          )}

          {connectionError && (
            <div
              role="alert"
              className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <span>{connectionError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConnectionAttempt((value) => value + 1)}
                disabled={loadingConnections}
              >
                <RefreshCw aria-hidden="true" className="size-4" /> Reintentar
                conexiones
              </Button>
            </div>
          )}

          {query && (
            <div className="border-b border-border pb-4">
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

          {!cube && !loadingConnections && !connectionError && (
            <div
              className="grid min-h-80 place-items-center rounded-md border border-dashed border-border p-6 text-center"
              role="status"
            >
              <div className="max-w-sm space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Ningún cubo seleccionado
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Selecciona un cubo en el panel lateral para comenzar una
                  consulta.
                </p>
              </div>
            </div>
          )}
          {/* Results Container */}
          {cube && (
            <div className="min-h-80 bg-background p-1">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h2 className="font-semibold text-foreground text-base">
                    Resultados
                  </h2>
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
                        {[
                          'Bars',
                          'Lines',
                          'Proportional',
                          'Matrix',
                          'Points',
                          'Geo',
                        ].map((grp) => (
                          <optgroup key={grp} label={chartLabel(grp)}>
                            {CHART_TYPES.filter((t) => t.group === grp).map(
                              (type) => (
                                <option key={type.id} value={type.id}>
                                  {chartLabel(type.label)}
                                </option>
                              ),
                            )}
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
                <>
                  {['pie', 'donut'].includes(chartType) &&
                    projection.rowCategories.length > 12 && (
                      <p
                        role="status"
                        className="mb-4 rounded-md bg-muted px-4 py-3 text-sm leading-6 text-muted-foreground"
                      >
                        Este gráfico tiene {projection.rowCategories.length}{' '}
                        categorías y puede ser difícil de leer. Usa barras o
                        filtra los datos para compararlos mejor.
                      </p>
                    )}
                  <SaikuChart
                    chartType={
                      chartType as Parameters<typeof SaikuChart>[0]['chartType']
                    }
                    projection={projection}
                    height={460}
                    ariaLabel={`Gráfico de consulta con ${projection.rowCategories.length} categorías y ${projection.columnCategories.length} medidas`}
                  />
                </>
              ) : (
                <CellsetTable
                  result={displayResult}
                  loading={running}
                  onDrillthrough={handleDrillthrough}
                />
              )}
            </div>
          )}
        </section>
      </div>

      {/* Drillthrough result dialog */}
      <DrillthroughResultModal
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        result={drillResult}
        loadingLabel={
          drillLoading ? 'Consultando registros transaccionales…' : undefined
        }
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
          initialMeasure={
            query.queryModel.axes[orderModalAxis].sortEvaluationLiteral || ''
          }
          initialSort={
            (query.queryModel.axes[orderModalAxis].sortOrder as SortFunction) ||
            'ASC'
          }
          onCancel={() => setOrderModalAxis(null)}
          onSave={(expression, sort) => {
            const next = structuredClone(query);
            next.queryModel.axes[orderModalAxis].sortOrder = sort;
            next.queryModel.axes[orderModalAxis].sortEvaluationLiteral =
              expression;
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
              {
                filterType: 'TopCount',
                count: parseInt(countOrExpr, 10) || 10,
              },
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
          hierarchyCaption={
            selectedHierarchy?.caption ?? memberModalConfig.hierarchyUniqueName
          }
          levelCaption={selectedLevel?.caption}
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
      label: isUatfCube(query.cube)
        ? academicLabel(hierarchy.caption || hierarchy.name)
        : hierarchy.caption || hierarchy.name,
      kind: 'hierarchy' as const,
      dimensionUniqueName: hierarchy.dimension,
      hierarchyUniqueName: hierarchy.name,
    }));
  }
  axes.COLUMNS = [
    ...query.queryModel.details.measures.map((measure) => ({
      id: measure.uniqueName,
      label: isUatfCube(query.cube)
        ? academicLabel(measure.caption || measure.name)
        : measure.caption || measure.name,
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

function isRestorableQuery(value: unknown): value is ThinQuery {
  if (!value || typeof value !== 'object') return false;
  const query = value as Partial<ThinQuery>;
  const cube = query.cube as Partial<SaikuCube> | undefined;
  const model = query.queryModel;
  const axes = model?.axes;
  return (
    query.queryType === 'OLAP' &&
    query.type === 'QUERYMODEL' &&
    typeof cube?.uniqueName === 'string' &&
    typeof cube.connection === 'string' &&
    typeof cube.catalog === 'string' &&
    typeof cube.schema === 'string' &&
    typeof cube.name === 'string' &&
    isValidAxis(axes?.COLUMNS) &&
    isValidAxis(axes?.ROWS) &&
    isValidAxis(axes?.FILTER) &&
    isValidAxis(axes?.PAGES) &&
    Array.isArray(model?.details?.measures) &&
    model.details.measures.every(
      (measure) =>
        measure &&
        typeof measure.uniqueName === 'string' &&
        typeof measure.name === 'string',
    )
  );
}

function isValidAxis(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const axis = value as { hierarchies?: unknown };
  return (
    Array.isArray(axis.hierarchies) &&
    axis.hierarchies.every((hierarchy) => {
      if (!hierarchy || typeof hierarchy !== 'object') return false;
      const candidate = hierarchy as { name?: unknown; levels?: unknown };
      return (
        typeof candidate.name === 'string' &&
        Boolean(candidate.levels) &&
        typeof candidate.levels === 'object'
      );
    })
  );
}
