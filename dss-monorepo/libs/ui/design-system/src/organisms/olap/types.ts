import type { AxisLocation } from '@dss-monorepo/olap-models';

export type OlapQueryItemKind = 'dimension' | 'hierarchy' | 'level' | 'measure';

/** A dimension member that can be placed on one of the query axes. */
export interface OlapQueryItem {
  id: string;
  label: string;
  kind: OlapQueryItemKind;
  dimensionUniqueName?: string;
  hierarchyUniqueName?: string;
  levelUniqueName?: string;
}

export type OlapQueryAxes = Record<AxisLocation, readonly OlapQueryItem[]>;

export const OLAP_AXIS_ORDER: readonly AxisLocation[] = [
  'FILTER',
  'COLUMNS',
  'ROWS',
  'PAGES',
];

export const OLAP_AXIS_LABELS: Record<AxisLocation, string> = {
  FILTER: 'Filtros',
  COLUMNS: 'Columnas',
  ROWS: 'Filas',
  PAGES: 'Páginas',
};

export const OLAP_AXIS_DESCRIPTIONS: Record<AxisLocation, string> = {
  FILTER: 'Restringe los datos sin mostrarlos en la tabla.',
  COLUMNS: 'Organiza medidas o dimensiones en columnas.',
  ROWS: 'Organiza miembros como filas de la consulta.',
  PAGES: 'Mantiene esta dimensión disponible como selector.',
};
