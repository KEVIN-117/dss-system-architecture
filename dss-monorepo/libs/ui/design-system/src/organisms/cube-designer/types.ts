import type { Edge, Node } from '@xyflow/react';

/** A physical column available to a cube's schema. */
export interface CubeSchemaColumn {
  name: string;
  dataType: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

/** A physical table that can be placed on the schema canvas. */
export interface CubeSchemaTable {
  id: string;
  name: string;
  schema?: string;
  columns: readonly CubeSchemaColumn[];
  role?: 'fact' | 'dimension';
}

export interface CubeTableNodeData extends Record<string, unknown> {
  table: CubeSchemaTable;
  onRemove?: (tableId: string) => void;
}

export type CubeTableNode = Node<CubeTableNodeData, 'cubeTable'>;
export type CubeJoinEdge = Edge<{
  label?: string;
  relationship?: 'one-to-one' | 'one-to-many' | 'many-to-many';
}>;

export interface CubeDesignerState {
  nodes: CubeTableNode[];
  edges: CubeJoinEdge[];
}
