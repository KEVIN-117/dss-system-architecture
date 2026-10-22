'use client';

import * as React from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Braces,
  Check,
  Clipboard,
  CodeXml,
  Database,
  KeyRound,
  Layers3,
  Table2,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';

export interface OlapSchemaColumnView {
  name: string;
  keyType?: 'primary' | 'foreign';
}

export interface OlapSchemaTableView {
  id: string;
  name: string;
  role: 'fact' | 'dimension';
  columns: OlapSchemaColumnView[];
}

export interface OlapSchemaRelationshipView {
  id: string;
  source: string;
  target: string;
  sourceColumn: string;
  targetColumn: string;
}

export interface OlapSchemaDimensionView {
  name: string;
  hierarchy?: string;
  levels: string[];
}

export interface OlapSchemaMeasureView {
  name: string;
  column?: string;
  aggregator?: string;
}

export interface OlapSchemaViewModel {
  schemaName: string;
  cubeName: string;
  tables: OlapSchemaTableView[];
  relationships: OlapSchemaRelationshipView[];
  dimensions: OlapSchemaDimensionView[];
  measures: OlapSchemaMeasureView[];
}

interface TableNodeData extends Record<string, unknown> {
  table: OlapSchemaTableView;
  handles: Array<{
    id: string;
    type: 'source' | 'target';
    position: Position;
  }>;
}

type SchemaNode = Node<TableNodeData, 'schemaTable'>;

function SchemaTableNode({ data, selected }: NodeProps<SchemaNode>) {
  const { table } = data;
  return (
    <article
      className={`w-64 overflow-visible rounded-lg border bg-card text-card-foreground shadow-sm transition-colors ${selected ? 'border-primary ring-2 ring-ring/30' : 'border-border'}`}
    >
      {data.handles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          isConnectable={false}
          className={`!size-2.5 !border-2 !border-card ${handle.type === 'source' ? '!bg-primary' : '!bg-muted-foreground'}`}
        />
      ))}
      <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          {table.role === 'fact' ? (
            <Database className="size-4" aria-hidden="true" />
          ) : (
            <Table2 className="size-4" aria-hidden="true" />
          )}
        </span>
        <h3
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          title={table.name}
        >
          {table.name}
        </h3>
        <Badge variant={table.role === 'fact' ? 'default' : 'secondary'}>
          {table.role === 'fact' ? 'Hecho' : 'Dimensión'}
        </Badge>
      </header>
      <ul className="divide-y divide-border">
        {table.columns.length ? (
          table.columns.map((column) => (
            <li
              key={column.name}
              className="flex items-center gap-2 px-3 py-1.5 text-xs"
            >
              {column.keyType ? (
                <KeyRound
                  className={`size-3 shrink-0 ${column.keyType === 'primary' ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-label={
                    column.keyType === 'primary' ? 'Primary key' : 'Foreign key'
                  }
                />
              ) : (
                <span className="size-3 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate" title={column.name}>
                {column.name}
              </span>
              {column.keyType && (
                <span className="text-muted-foreground">
                  {column.keyType === 'primary' ? 'PK' : 'FK'}
                </span>
              )}
            </li>
          ))
        ) : (
          <li className="px-3 py-2 text-xs text-muted-foreground">
            Sin columnas disponibles
          </li>
        )}
      </ul>
      <footer className="bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        {table.columns.length}{' '}
        {table.columns.length === 1 ? 'columna' : 'columnas'}
      </footer>
    </article>
  );
}

const nodeTypes = { schemaTable: SchemaTableNode };

function OlapSchemaViewerCanvas({
  schema,
  xml,
  onBack,
}: {
  schema: OlapSchemaViewModel;
  xml: string;
  onBack?: () => void;
}) {
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(
    schema.tables.find((table) => table.role === 'fact')?.id ??
      schema.tables[0]?.id ??
      null,
  );
  const selectedTable = schema.tables.find(
    (table) => table.id === selectedTableId,
  );
  const { positions, edges } = React.useMemo(() => {
    const dimensions = schema.tables.filter((table) => table.role !== 'fact');
    const tablePositions = new Map<string, { x: number; y: number }>();
    const baseNodes = schema.tables.map((table) => {
      const dimensionIndex = dimensions.findIndex(
        (dimension) => dimension.id === table.id,
      );
      const angle =
        (dimensionIndex / Math.max(dimensions.length, 1)) * Math.PI * 2;
      const position =
        table.role === 'fact'
          ? { x: 500, y: 300 }
          : {
              x: Math.round(500 + Math.cos(angle) * 410),
              y: Math.round(300 + Math.sin(angle) * 220),
            };
      tablePositions.set(table.id, position);
      return {
        id: table.id,
        type: 'schemaTable' as const,
        position,
        // MiniMap only draws nodes that declare dimensions. The table card has
        // a fixed width and rows with consistent height, so keep its overview
        // geometry in sync with the rendered node.
        width: 256,
        height: 76 + Math.max(table.columns.length, 1) * 31,
        data: { table, handles: [] },
        draggable: false,
        selectable: true,
      } satisfies SchemaNode;
    });
    const handlesByTable = new Map<string, TableNodeData['handles']>();
    const edgeData = schema.relationships.flatMap((relationship) => {
      const source = tablePositions.get(relationship.source);
      const target = tablePositions.get(relationship.target);
      if (!source || !target) return [];

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const sourceSide =
        Math.abs(dx) >= Math.abs(dy)
          ? dx >= 0
            ? { id: 'right', position: Position.Right }
            : { id: 'left', position: Position.Left }
          : dy >= 0
            ? { id: 'bottom', position: Position.Bottom }
            : { id: 'top', position: Position.Top };
      const targetSide =
        sourceSide.id === 'right'
          ? { id: 'left', position: Position.Left }
          : sourceSide.id === 'left'
            ? { id: 'right', position: Position.Right }
            : sourceSide.id === 'bottom'
              ? { id: 'top', position: Position.Top }
              : { id: 'bottom', position: Position.Bottom };
      const sourceHandle = `source-${sourceSide.id}`;
      const targetHandle = `target-${targetSide.id}`;
      const addHandle = (
        tableId: string,
        handle: TableNodeData['handles'][number],
      ) => {
        const tableHandles = handlesByTable.get(tableId) ?? [];
        if (!tableHandles.some((item) => item.id === handle.id)) {
          tableHandles.push(handle);
          handlesByTable.set(tableId, tableHandles);
        }
      };
      addHandle(relationship.source, {
        id: sourceHandle,
        type: 'source',
        position: sourceSide.position,
      });
      addHandle(relationship.target, {
        id: targetHandle,
        type: 'target',
        position: targetSide.position,
      });
      return [{ ...relationship, sourceHandle, targetHandle }];
    });
    const nodes = baseNodes.map((node) => ({
      ...node,
      data: { ...node.data, handles: handlesByTable.get(node.id) ?? [] },
    }));
    const flowEdges: Edge[] = edgeData.map((relationship) => ({
      id: relationship.id,
      source: relationship.source,
      target: relationship.target,
      sourceHandle: relationship.sourceHandle,
      targetHandle: relationship.targetHandle,
      type: 'smoothstep',
      label:
        relationship.sourceColumn === relationship.targetColumn
          ? relationship.sourceColumn
          : `${relationship.sourceColumn} → ${relationship.targetColumn}`,
      labelStyle: {
        fill: 'var(--foreground)',
        fontSize: 10,
        fontWeight: 600,
      },
      labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.96 },
      labelBgPadding: [8, 5],
      labelBgBorderRadius: 6,
      style: { stroke: 'var(--primary)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
      selectable: false,
    }));
    return { positions: nodes, edges: flowEdges };
  }, [schema.tables, schema.relationships]);
  const [xmlCopied, setXmlCopied] = React.useState(false);
  const [editorTheme, setEditorTheme] = React.useState('vs-dark');
  const viewerRef = React.useRef<HTMLElement>(null);
  const [xmlExpanded, setXmlExpanded] = React.useState(false);

  React.useEffect(() => {
    const updateTheme = () => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      // Storybook and the portals can apply the dark class to a theme wrapper
      // inside the document, so the body color alone is not a reliable signal.
      const themeRoot = viewer.closest('[data-theme]') ?? viewer;
      const darkClass = Boolean(themeRoot.closest('.dark'));
      const probe = document.createElement('span');
      probe.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;background-color:var(--background)';
      themeRoot.append(probe);
      const background = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const channels = background
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
      const luminance = channels
        ? channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        : 255;
      setEditorTheme(darkClass || luminance < 145 ? 'vs-dark' : 'light');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  const copyXml = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setXmlCopied(true);
      window.setTimeout(() => setXmlCopied(false), 1800);
    } catch {
      setXmlCopied(false);
    }
  };

  return (
    <section
      ref={viewerRef}
      className="space-y-5"
      aria-labelledby="olap-schema-viewer-title"
    >
      <header className="flex flex-wrap items-start gap-3">
        {onBack && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to schemas"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1
            id="olap-schema-viewer-title"
            className="text-2xl font-semibold tracking-tight"
          >
            {schema.cubeName || schema.schemaName}
          </h1>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            Esquema {schema.schemaName} · Modelo publicado en Saiku
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Resumen del cubo">
          <Badge variant="outline">{schema.tables.length} tables</Badge>
          <Badge variant="outline">
            {schema.relationships.length} relationships
          </Badge>
          <Badge variant="outline">{schema.dimensions.length} dimensions</Badge>
          <Badge variant="outline">{schema.measures.length} measures</Badge>
        </div>
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
          aria-label="Canvas del modelo físico"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="font-medium">Modelo físico</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tablas, claves y relaciones del cubo
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Database
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />{' '}
                Hecho
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Table2 className="size-3.5" aria-hidden="true" /> Dimensión
              </span>
            </div>
          </div>
          <div
            className="h-[min(70vh,640px)] min-h-[420px] min-w-0 bg-muted/20"
            aria-label="Diagrama de tablas y relaciones"
          >
            {schema.tables.length ? (
              <ReactFlow
                nodes={positions}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => setSelectedTableId(node.id)}
                onPaneClick={() => setSelectedTableId(null)}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                fitView
                fitViewOptions={{ padding: 0.18 }}
                minZoom={0.2}
                maxZoom={1.6}
                panOnScroll
                zoomOnDoubleClick={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="var(--border)"
                />
                <Controls
                  position="bottom-left"
                  className="cube-designer-controls"
                  aria-label="Canvas controls"
                />
                <MiniMap
                  position="bottom-right"
                  className="schema-viewer-minimap"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                  }}
                  nodeColor={(node) =>
                    schema.tables.find((table) => table.id === node.id)
                      ?.role === 'fact'
                      ? 'var(--primary)'
                      : 'var(--muted-foreground)'
                  }
                  maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
                  ariaLabel="Vista general del esquema"
                />
              </ReactFlow>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <Database
                    className="mx-auto size-8 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 font-medium">
                    Este XML no declara tablas físicas
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Revisa las dimensiones y medidas, o consulta el XML fuente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4" aria-label="Cube definition">
          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 font-medium">
                <Layers3 className="size-4 text-primary" aria-hidden="true" />{' '}
                Dimensiones
              </h2>
            </div>
            <div className="max-h-64 space-y-4 overflow-y-auto p-4">
              {schema.dimensions.length ? (
                schema.dimensions.map((dimension) => (
                  <div key={`${dimension.name}-${dimension.hierarchy ?? ''}`}>
                    <p className="text-sm font-medium">{dimension.name}</p>
                    {dimension.hierarchy && (
                      <p className="text-xs text-muted-foreground">
                        Jerarquía: {dimension.hierarchy}
                      </p>
                    )}
                    <ol
                      className="mt-2 flex flex-wrap gap-1.5"
                      aria-label={`Niveles de ${dimension.name}`}
                    >
                      {dimension.levels.map((level, index) => (
                        <li key={`${level}-${index}`}>
                          <Badge variant="secondary">{level}</Badge>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No dimensions are declared.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-medium">Medidas</h2>
            </div>
            <ul className="divide-y divide-border">
              {schema.measures.length ? (
                schema.measures.map((measure) => (
                  <li
                    key={`${measure.name}-${measure.column ?? ''}`}
                    className="px-4 py-3"
                  >
                    <p className="text-sm font-medium">{measure.name}</p>
                    <p className="mt-0.5 break-all text-xs text-muted-foreground">
                      {[measure.aggregator, measure.column]
                        .filter(Boolean)
                        .join(' · ') || 'Agregación no especificada'}
                    </p>
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  No measures are declared.
                </li>
              )}
            </ul>
          </section>

          {selectedTable && (
            <section
              className="rounded-xl border border-border bg-card p-4"
              aria-live="polite"
            >
              <h2 className="text-sm font-medium">Tabla seleccionada</h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {selectedTable.name}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedTable.role === 'fact'
                  ? 'Tabla de hechos'
                  : 'Tabla de dimensión'}{' '}
                · {selectedTable.columns.length} columnas identificadas
              </p>
              <ul className="mt-3 space-y-2 border-t border-border pt-3">
                {schema.relationships
                  .filter(
                    (relationship) =>
                      relationship.source === selectedTable.id ||
                      relationship.target === selectedTable.id,
                  )
                  .map((relationship) => (
                    <li
                      key={relationship.id}
                      className="text-xs leading-relaxed text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {relationship.sourceColumn}
                      </span>{' '}
                      <span aria-hidden="true">→</span>{' '}
                      <span className="font-medium text-foreground">
                        {relationship.targetColumn}
                      </span>
                      <span className="mt-0.5 block">
                        {relationship.source} · {relationship.target}
                      </span>
                    </li>
                  ))}
                {!schema.relationships.some(
                  (relationship) =>
                    relationship.source === selectedTable.id ||
                    relationship.target === selectedTable.id,
                ) && (
                  <li className="text-xs text-muted-foreground">
                    Esta tabla no tiene relaciones declaradas.
                  </li>
                )}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <details
        className="group overflow-hidden rounded-xl border border-border bg-card"
        onToggle={(event) => setXmlExpanded(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CodeXml className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block">XML fuente</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Documento original del esquema · Solo lectura
            </span>
          </span>
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
            Mostrar código
          </span>
          <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">
            Ocultar código
          </span>
        </summary>
        <div className="border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Braces className="size-3.5" aria-hidden="true" />
              <span className="font-mono">{schema.schemaName}.xml</span>
              <span aria-hidden="true">·</span>
              <span>XML</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyXml}
              aria-label={xmlCopied ? 'XML copiado' : 'Copiar XML'}
            >
              {xmlCopied ? (
                <Check className="mr-2 size-4" aria-hidden="true" />
              ) : (
                <Clipboard className="mr-2 size-4" aria-hidden="true" />
              )}
              {xmlCopied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          {xmlExpanded && (
            <div className="min-h-[360px] bg-background">
              <Editor
                height="min(68vh, 640px)"
                language="xml"
                theme={editorTheme}
                value={xml}
                options={{
                  ariaLabel: 'XML fuente del esquema OLAP',
                  automaticLayout: true,
                  readOnly: true,
                  fontSize: 13,
                  lineHeight: 21,
                  lineNumbers: 'on',
                  minimap: { enabled: false },
                  padding: { top: 14, bottom: 14 },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  wordWrap: 'off',
                  folding: true,
                  renderLineHighlight: 'line',
                  guides: { indentation: true },
                }}
              />
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

export interface OlapSchemaViewerProps {
  schema: OlapSchemaViewModel;
  xml: string;
  onBack?: () => void;
}

export function OlapSchemaViewer(props: OlapSchemaViewerProps) {
  return (
    <ReactFlowProvider>
      <OlapSchemaViewerCanvas {...props} />
    </ReactFlowProvider>
  );
}
