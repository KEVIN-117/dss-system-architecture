'use client';

import * as React from 'react';
import {
  AlertCircle,
  Clock,
  Code2,
  Copy,
  Database,
  History,
  Play,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { QueryResult, SaikuConnection, SaikuCube } from '@dss-monorepo/olap-models';
import { Button } from '../../atoms/button';
import { Select } from '../../atoms/select';
import { CellsetTable } from './cellset-table';
import { MonacoExpressionEditor } from '../olap-modals/monaco-expression-editor';
import { DrillthroughResultModal, type DrillthroughResult } from '../olap-modals/drill-modals';

export interface MdxHistoryEntry {
  id: string;
  timestamp: number;
  mdx: string;
  cubeName: string;
  runtimeMs?: number;
  rowCount?: number;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
}

export interface MdxWorkbenchProps {
  connections: SaikuConnection[];
  selectedCube?: SaikuCube | null;
  onSelectCube?: (cube: SaikuCube | null) => void;
  onExecuteMdx: (mdx: string, cube: SaikuCube) => Promise<QueryResult>;
  onPreviewSql?: (mdx: string, cube: SaikuCube) => Promise<string>;
  onDrillthrough?: (queryName: string, position?: string) => Promise<DrillthroughResult>;
  initialMdx?: string;
  className?: string;
  renderChart?: (result: QueryResult) => React.ReactNode;
}

const STORAGE_KEY = 'saiku_mdx_workbench_history';

/** Full-featured MDX & SQL Workbench component matching Saiku Analytics 4.8. */
export function MdxWorkbench({
  connections,
  selectedCube,
  onSelectCube,
  onExecuteMdx,
  onPreviewSql,
  onDrillthrough,
  initialMdx = '',
  className,
  renderChart,
}: MdxWorkbenchProps) {
  const allCubes = React.useMemo(() => {
    const list: SaikuCube[] = [];
    for (const conn of connections) {
      for (const cat of conn.catalogs ?? []) {
        for (const schema of cat.schemas ?? []) {
          for (const c of schema.cubes ?? []) {
            list.push(c);
          }
        }
      }
    }
    return list;
  }, [connections]);

  const [cube, setCube] = React.useState<SaikuCube | null>(
    selectedCube || allCubes[0] || null,
  );

  React.useEffect(() => {
    if (selectedCube) setCube(selectedCube);
    else if (!cube && allCubes.length > 0) setCube(allCubes[0]);
  }, [selectedCube, allCubes, cube]);

  const defaultMdxTemplate = React.useMemo(() => {
    if (!cube) return 'SELECT {} ON COLUMNS,\n{} ON ROWS\nFROM [Cube]';
    return `SELECT\n  NON EMPTY {[Measures].Members} ON COLUMNS,\n  NON EMPTY {[Dimension].Members} ON ROWS\nFROM [${cube.name}]`;
  }, [cube]);

  const [mdx, setMdx] = React.useState<string>(initialMdx || defaultMdxTemplate);
  const [activeTab, setActiveTab] = React.useState<'editor' | 'sql' | 'history'>('editor');
  const [resultView, setResultView] = React.useState<'table' | 'chart'>('table');
  const [running, setRunning] = React.useState(false);
  const [previewingSql, setPreviewingSql] = React.useState(false);
  const [sqlText, setSqlText] = React.useState<string | null>(null);
  const [sqlError, setSqlError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Drillthrough state
  const [drillResult, setDrillResult] = React.useState<DrillthroughResult | null>(null);
  const [drillOpen, setDrillOpen] = React.useState(false);
  const [drillLoading, setDrillLoading] = React.useState(false);

  // History state
  const [history, setHistory] = React.useState<MdxHistoryEntry[]>([]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved) as MdxHistoryEntry[]);
    } catch {
      // ignore
    }
  }, []);

  const saveHistory = (entry: Omit<MdxHistoryEntry, 'id' | 'timestamp'>) => {
    const fullEntry: MdxHistoryEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setHistory((prev) => {
      const next = [fullEntry, ...prev.slice(0, 24)];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleCubeChange = (uniqueCubeKey: string) => {
    const found = allCubes.find(
      (c) => `${c.connection}/${c.catalog}/${c.schema}/${c.name}` === uniqueCubeKey,
    );
    if (found) {
      setCube(found);
      onSelectCube?.(found);
      if (mdx === defaultMdxTemplate) {
        setMdx(
          `SELECT\n  NON EMPTY {[Measures].Members} ON COLUMNS,\n  NON EMPTY {[Dimension].Members} ON ROWS\nFROM [${found.name}]`,
        );
      }
    }
  };

  const handleRun = async () => {
    if (!cube || !mdx.trim() || running) return;
    setRunning(true);
    setError(null);
    const start = Date.now();
    try {
      const res = await onExecuteMdx(mdx, cube);
      const runtime = res.runtime || Date.now() - start;
      if (res.error) throw new Error(res.error);
      setResult(res);
      setResultView('table');
      saveHistory({
        mdx,
        cubeName: cube.name,
        runtimeMs: runtime,
        rowCount: res.cellset?.length ?? 0,
        status: 'SUCCESS',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al ejecutar MDX';
      setError(msg);
      setResult(null);
      saveHistory({
        mdx,
        cubeName: cube.name,
        runtimeMs: Date.now() - start,
        status: 'ERROR',
        error: msg,
      });
    } finally {
      setRunning(false);
    }
  };

  const handlePreviewSql = async () => {
    if (!cube || !mdx.trim() || !onPreviewSql) return;
    setPreviewingSql(true);
    setSqlError(null);
    try {
      const sql = await onPreviewSql(mdx, cube);
      setSqlText(sql);
      setActiveTab('sql');
    } catch (err) {
      setSqlError(err instanceof Error ? err.message : 'No se pudo generar el SQL preview.');
      setActiveTab('sql');
    } finally {
      setPreviewingSql(false);
    }
  };

  const copyMdx = async () => {
    await navigator.clipboard?.writeText(mdx);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCellDrillthrough = async (
    cell: unknown,
    position?: string,
  ) => {
    if (!onDrillthrough || !result?.query?.name) return;
    setDrillLoading(true);
    setDrillOpen(true);
    try {
      const res = await onDrillthrough(result.query.name, position);
      setDrillResult(res);
    } catch (err) {
      setDrillResult({
        columns: [],
        rows: [],
        error: err instanceof Error ? err.message : 'Fallo en consulta drillthrough.',
      });
    } finally {
      setDrillLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cubo activo:
            </span>
            <Select
              aria-label="Seleccionar cubo para el Workbench"
              value={cube ? `${cube.connection}/${cube.catalog}/${cube.schema}/${cube.name}` : ''}
              onChange={(e) => handleCubeChange(e.target.value)}
              className="h-9 w-60 text-xs"
            >
              {allCubes.map((c) => (
                <option
                  key={`${c.connection}/${c.catalog}/${c.schema}/${c.name}`}
                  value={`${c.connection}/${c.catalog}/${c.schema}/${c.name}`}
                >
                  {c.caption || c.name} ({c.schema})
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyMdx}
            className="h-9 gap-1.5 text-xs"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            <span>{copied ? '¡Copiado!' : 'Copiar MDX'}</span>
          </Button>

          {onPreviewSql && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviewSql}
              disabled={previewingSql || !cube}
              className="h-9 gap-1.5 text-xs"
              title="Ver el SQL generado por Mondrian/Calcite"
            >
              <Database className="size-3.5" aria-hidden="true" />
              <span>{previewingSql ? 'Traduciendo…' : 'Vista previa SQL'}</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={handleRun}
            disabled={running || !cube || !mdx.trim()}
            className="h-9 gap-2 text-xs font-medium"
          >
            <Play className="size-3.5 fill-current" aria-hidden="true" />
            <span>{running ? 'Ejecutando…' : 'Ejecutar (Ctrl+Enter)'}</span>
          </Button>
        </div>
      </div>

      {/* Editor & Auxiliary Views */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 pt-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'editor'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code2 className="size-3.5" aria-hidden="true" />
              <span>Editor MDX</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'sql'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Database className="size-3.5" aria-hidden="true" />
              <span>SQL Traducido {sqlText ? '•' : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'history'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="size-3.5" aria-hidden="true" />
              <span>Historial ({history.length})</span>
            </button>
          </div>

          <span className="text-[0.7rem] text-muted-foreground font-mono">
            {cube ? `FROM [${cube.name}]` : 'Sin cubo'}
          </span>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {activeTab === 'editor' && (
            <div
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handleRun();
                }
              }}
            >
              <MonacoExpressionEditor
                id="workbench-mdx-editor"
                value={mdx}
                onChange={setMdx}
                minRows={14}
              />
              <p className="mt-2 text-[0.7rem] text-muted-foreground">
                Presiona <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">Ctrl+Enter</kbd> para ejecutar la consulta directamente.
              </p>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              {sqlError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
                  <p className="font-semibold">Error al obtener el SQL:</p>
                  <p className="mt-1">{sqlError}</p>
                </div>
              ) : sqlText ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      SQL generado por Mondrian / Apache Calcite:
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void navigator.clipboard?.writeText(sqlText)}
                      className="h-7 gap-1 text-xs"
                    >
                      <Copy className="size-3" aria-hidden="true" />
                      <span>Copiar SQL</span>
                    </Button>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/60 p-4 font-mono text-xs leading-relaxed text-foreground">
                    {sqlText}
                  </pre>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <Database className="mx-auto size-6 mb-2 opacity-50" aria-hidden="true" />
                  Presiona "Vista previa SQL" en la barra superior para ver el SQL generado para este cubo.
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <Clock className="mx-auto size-6 mb-2 opacity-50" aria-hidden="true" />
                  No hay consultas registradas en este navegador todavía.
                </div>
              ) : (
                <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-3 text-xs transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold text-[0.65rem] ${
                              item.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-destructive/10 text-destructive'
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="font-medium text-foreground">
                            [{item.cubeName}]
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                          {item.runtimeMs != null && (
                            <span className="text-muted-foreground">
                              · {item.runtimeMs} ms
                            </span>
                          )}
                        </div>
                        <pre className="mt-1 line-clamp-2 truncate font-mono text-[0.7rem] text-muted-foreground">
                          {item.mdx}
                        </pre>
                        {item.error && (
                          <p className="mt-1 text-destructive font-mono text-[0.7rem]">
                            {item.error}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMdx(item.mdx);
                          setActiveTab('editor');
                        }}
                        className="h-7 text-xs"
                      >
                        Cargar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Resultados</h2>
            <p className="text-xs text-muted-foreground">
              {result
                ? `${result.height ?? result.cellset.length} filas · ${result.runtime ?? 0} ms`
                : 'Ejecuta la consulta MDX para ver el CellSet devuelto.'}
            </p>
          </div>

          {result && (
            <div className="flex items-center gap-2">
              <Button
                variant={resultView === 'table' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setResultView('table')}
                className="h-8 gap-1.5 text-xs"
              >
                <Table2 className="size-3.5" aria-hidden="true" />
                <span>Tabla</span>
              </Button>
              {renderChart && (
                <Button
                  variant={resultView === 'chart' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setResultView('chart')}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>Gráfico</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {error ? (
          <div
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Error de ejecución MDX</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{error}</p>
            </div>
          </div>
        ) : resultView === 'chart' && renderChart && result ? (
          renderChart(result)
        ) : (
          <CellsetTable
            result={result}
            loading={running}
            onDrillthrough={handleCellDrillthrough}
          />
        )}
      </section>

      {/* Drillthrough modal */}
      <DrillthroughResultModal
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        result={drillResult}
        loadingLabel={drillLoading ? 'Consultando datos transaccionales…' : undefined}
      />
    </div>
  );
}
