'use client';

import * as React from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowDownToLine,
  Boxes,
  Database,
  GitBranch,
  Layers3,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Badge } from '../../atoms/badge';
import { CubeTableNode } from './cube-table-node';
import type {
  CubeDesignerState,
  CubeJoinEdge,
  CubeSchemaTable,
  CubeTableNode as CubeNode,
} from './types';

export type {
  CubeDesignerState,
  CubeJoinEdge,
  CubeSchemaColumn,
  CubeSchemaTable,
} from './types';

export interface CubeDesignerProps {
  tables: readonly CubeSchemaTable[];
  initialState?: CubeDesignerState;
  title?: string;
  description?: string;
  onSchemaChange?: (state: CubeDesignerState) => void;
  onSave?: (state: CubeDesignerState) => void | Promise<void>;
  onPublish?: (state: CubeDesignerState) => void | Promise<void>;
  className?: string;
}

const nodeTypes = { cubeTable: CubeTableNode };
function makeNode(table: CubeSchemaTable, index: number): CubeNode {
  return {
    id: table.id,
    type: 'cubeTable',
    position: {
      x: 80 + (index % 3) * 360,
      y: 80 + Math.floor(index / 3) * 300,
    },
    data: { table },
  };
}

function CubeDesignerCanvas({
  tables,
  initialState,
  title,
  description,
  onSchemaChange,
  onSave,
  onPublish,
  className,
}: CubeDesignerProps) {
  const [nodes, setNodes] = React.useState<CubeNode[]>(
    () => initialState?.nodes ?? [],
  );
  const [edges, setEdges] = React.useState<CubeJoinEdge[]>(
    () => initialState?.edges ?? [],
  );
  const [search, setSearch] = React.useState('');
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(
    nodes[0]?.id ?? null,
  );
  const [busyAction, setBusyAction] = React.useState<'save' | 'publish' | null>(
    null,
  );
  const [actionError, setActionError] = React.useState<string | null>(null);
  const state = React.useMemo(() => ({ nodes, edges }), [nodes, edges]);
  const selectedNode = nodes.find((node) => node.id === selectedTableId);
  const placedIds = new Set(nodes.map((node) => node.id));
  const filteredTables = tables.filter((table) =>
    `${table.schema ?? ''} ${table.name}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  React.useEffect(() => {
    onSchemaChange?.(state);
  }, [onSchemaChange, state]);

  const addTable = (table: CubeSchemaTable) => {
    if (placedIds.has(table.id)) {
      setSelectedTableId(table.id);
      return;
    }
    const nextIndex = nodes.length;
    const node = makeNode(table, nextIndex);
    node.data.onRemove = removeTable;
    setNodes((current) => [...current, node]);
    setSelectedTableId(table.id);
  };
  function removeTable(tableId: string) {
    setNodes((current) => current.filter((node) => node.id !== tableId));
    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== tableId && edge.target !== tableId,
      ),
    );
    setSelectedTableId((current) => (current === tableId ? null : current));
  }
  const onNodesChange = React.useCallback(
    (changes: NodeChange<CubeNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );
  const onEdgesChange = React.useCallback(
    (changes: EdgeChange<CubeJoinEdge>[]) =>
      setEdges((current) => applyEdgeChanges(changes, current)),
    [],
  );
  const onConnect: OnConnect = React.useCallback(
    (connection: Connection) => {
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);
      const sourceColumn = connection.sourceHandle?.replace('source:', '');
      const targetColumn = connection.targetHandle?.replace('target:', '');
      const label =
        source && target
          ? `${sourceColumn ?? ''} → ${targetColumn ?? ''}`
          : undefined;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            label,
            labelStyle: { fill: 'var(--foreground)', fontSize: 11 },
            labelBgStyle: { fill: 'var(--background)' },
          },
          current,
        ),
      );
    },
    [nodes],
  );
  const runAction = async (kind: 'save' | 'publish') => {
    const callback = kind === 'save' ? onSave : onPublish;
    if (!callback) return;
    setBusyAction(kind);
    setActionError(null);
    try {
      await callback(state);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'The action could not be completed.',
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section
      className={`flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground ${className ?? ''}`}
      aria-label="Cube Designer"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Boxes className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <Badge variant="secondary">{nodes.length} tables</Badge>
          <Badge variant="secondary">{edges.length} joins</Badge>
        </div>
        {onSave && (
          <Button
            variant="outline"
            onClick={() => void runAction('save')}
            disabled={busyAction !== null}
          >
            <ArrowDownToLine className="size-4" />
            {busyAction === 'save' ? 'Saving…' : 'Save draft'}
          </Button>
        )}
        {onPublish && (
          <Button
            onClick={() => void runAction('publish')}
            disabled={busyAction !== null}
          >
            <Sparkles className="size-4" />
            {busyAction === 'publish' ? 'Publishing…' : 'Publish cube'}
          </Button>
        )}
      </header>
      {actionError && (
        <p
          role="alert"
          className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <aside
          className="flex w-64 shrink-0 flex-col border-r border-border bg-card"
          aria-label="Table catalog"
        >
          <div className="border-b border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data catalog
              </h2>
              <Badge variant="outline">{tables.length}</Badge>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search tables"
                placeholder="Search tables…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredTables.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No tables match your search.
              </p>
            ) : (
              filteredTables.map((table) => {
                const placed = placedIds.has(table.id);
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => addTable(table)}
                    className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${placed ? 'Focus' : 'Add'} ${table.name}`}
                  >
                    <Database className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {table.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {table.schema ?? 'Default'} · {table.columns.length}{' '}
                        fields
                      </span>
                    </span>
                    {placed ? (
                      <Badge variant="secondary">Added</Badge>
                    ) : (
                      <Plus className="size-4 text-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border p-3 text-xs text-muted-foreground">
            Drag nodes to arrange. Connect key handles to define joins.
          </div>
        </aside>
        <main
          className="relative min-h-[560px] min-w-0 flex-1 bg-muted/20"
          aria-label="Schema canvas"
        >
          {nodes.length === 0 ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="max-w-sm rounded-xl border border-dashed border-border bg-background p-6 text-center shadow-sm">
                <Layers3 className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-3 font-semibold">Start with a table</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a fact table, then connect the dimensions that describe
                  it.
                </p>
              </div>
            </div>
          ) : null}
          <ReactFlow
            nodes={nodes.map((node) => ({
              ...node,
              data: { ...node.data, onRemove: removeTable },
            }))}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedTableId(node.id)}
            onPaneClick={() => setSelectedTableId(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.25}
            maxZoom={1.5}
            deleteKeyCode={['Backspace', 'Delete']}
            selectionOnDrag
            panOnScroll
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
              nodeColor={(node) =>
                node.id === selectedTableId
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)'
              }
              maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
            />
            <div className="react-flow__panel react-flow__panel-top-right flex gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-sm">
              <span className="px-2 py-1.5 text-xs text-muted-foreground">
                <GitBranch className="mr-1 inline size-3.5" />
                Schema canvas
              </span>
            </div>
          </ReactFlow>
        </main>
        <aside
          className="hidden w-72 shrink-0 border-l border-border bg-card xl:flex xl:flex-col"
          aria-label="Table inspector"
        >
          {selectedNode ? (
            <>
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inspector
                </p>
                <h2 className="mt-1 truncate text-sm font-semibold">
                  {selectedNode.data.table.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedNode.data.table.schema ?? 'Default schema'}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Table role
                  </p>
                  <p className="mt-1 text-sm">
                    {selectedNode.data.table.role === 'fact'
                      ? 'Fact table'
                      : 'Dimension table'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Columns
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {selectedNode.data.table.columns.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Connected joins
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {
                      edges.filter(
                        (edge) =>
                          edge.source === selectedNode.id ||
                          edge.target === selectedNode.id,
                      ).length
                    }
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                  Connect a column handle on this table to a column on another
                  table to create a relationship.
                </div>
              </div>
            </>
          ) : (
            <div className="m-auto px-5 text-center">
              <Database className="mx-auto size-6 text-muted-foreground" />
              <h2 className="mt-2 text-sm font-semibold">Nothing selected</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Select a table on the canvas to inspect it.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export function CubeDesigner(props: CubeDesignerProps) {
  return (
    <ReactFlowProvider>
      <CubeDesignerCanvas
        {...props}
        title={props.title ?? 'Cube Designer'}
        description={
          props.description ??
          'Model tables and relationships for your analytical cube.'
        }
      />
    </ReactFlowProvider>
  );
}
