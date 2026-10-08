export interface SaikuCube {
  connection: string;
  catalog: string;
  schema: string;
  name: string;
  caption: string;
  uniqueName: string;
  visible: boolean;
  timeCalcs?: SaikuTimeCalc[];
}

export interface SaikuTimeCalc {
  name: string;
  type: string;
  measure: string;
  timeDimension: string;
  window?: number;
  function?: string;
  formatString?: string;
}

export interface SaikuSchema {
  name: string;
  cubes: SaikuCube[];
}

export interface SaikuCatalog {
  name: string;
  schemas: SaikuSchema[];
}

export interface SaikuConnection {
  name: string;
  catalogs: SaikuCatalog[];
  type?: 'OLAP' | 'OSSIE';
}

export interface SaikuMember {
  uniqueName: string;
  name: string;
  caption: string;
  description?: string;
  levelUniqueName?: string;
  hierarchyUniqueName?: string;
  dimensionUniqueName?: string;
}

export interface SaikuLevel {
  name: string;
  caption: string;
  uniqueName: string;
  description?: string;
  levelType?: string;
}

export interface SaikuHierarchy {
  name: string;
  caption: string;
  uniqueName: string;
  levels?: SaikuLevel[];
}

export interface SaikuDimension {
  name: string;
  caption: string;
  uniqueName: string;
  hierarchies: SaikuHierarchy[];
  dimensionType?: string;
  measureGroups?: string[] | null;
}

export interface SaikuMeasure {
  name: string;
  caption: string;
  uniqueName: string;
  formula?: string;
  calculated?: boolean;
  visible?: boolean;
  measureGroup?: string | null;
}
