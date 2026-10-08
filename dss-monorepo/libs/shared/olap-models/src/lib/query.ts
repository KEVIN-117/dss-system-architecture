import type { SaikuCube } from './dimensions.js';

export type AxisLocation = 'FILTER' | 'COLUMNS' | 'ROWS' | 'PAGES';

export interface ThinLevel {
  name: string;
  selection?: {
    type: 'INCLUSION' | 'EXCLUSION';
    members: unknown[];
    parameterName?: string;
  };
}

export interface ThinHierarchy {
  name: string;
  caption?: string;
  dimension?: string;
  levels: Record<string, ThinLevel>;
  cmembers: Record<string, string>;
}

export interface ThinAxis {
  location: AxisLocation;
  mdx: string | null;
  filters: unknown[];
  sortOrder: string | null;
  sortEvaluationLiteral: string | null;
  hierarchizeMode: string | null;
  hierarchies: ThinHierarchy[];
  nonEmpty: boolean;
}

export interface ThinMeasure {
  name: string;
  uniqueName: string;
  caption: string;
  type: 'EXACT' | 'CALCULATED';
}

export interface ThinDetails {
  axis: AxisLocation;
  location: 'TOP' | 'BOTTOM';
  measures: ThinMeasure[];
}

export interface ThinQueryModel {
  axes: Record<AxisLocation, ThinAxis>;
  visualTotals: boolean;
  visualTotalsPattern: string | null;
  lowestLevelsOnly: boolean;
  details: ThinDetails;
  calculatedMeasures: unknown[];
  calculatedMembers: unknown[];
}

export interface ThinQuery {
  name: string;
  cube: SaikuCube;
  queryType: 'OLAP';
  type: 'QUERYMODEL' | 'MDX';
  queryModel?: ThinQueryModel;
  mdx?: string;
  properties?: Record<string, unknown>;
  parameters?: Record<string, string>;
}

export interface CellEntry {
  value: string;
  type: 'ROW_HEADER' | 'ROW_HEADER_HEADER' | 'COLUMN_HEADER' | 'DATA_CELL' | 'EMPTY' | 'UNKNOWN' | 'ERROR';
  properties?: Record<string, string>;
}

export interface QueryResult {
  cellset: CellEntry[][];
  rowTotalsLists?: unknown[];
  colTotalsLists?: unknown[];
  runtime?: number;
  error?: string;
  height?: number;
  width?: number;
  query?: ThinQuery;
  topOffset?: number;
  leftOffset?: number;
}

export type AsyncStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

/** Client-only chart and view state carried beside a ThinQuery deep link. */
export interface DeepLinkView {
  viewMode: string;
  chartType?: string;
  chartOptions?: unknown;
}
