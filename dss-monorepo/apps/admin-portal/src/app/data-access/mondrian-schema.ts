import type {
  OlapSchemaColumnView,
  OlapSchemaDimensionView,
  OlapSchemaMeasureView,
  OlapSchemaRelationshipView,
  OlapSchemaTableView,
  OlapSchemaViewModel,
} from '@dss-monorepo/design-system';

function requiredAttribute(
  element: Element | undefined,
  name: string,
): string | undefined {
  const value = element?.getAttribute(name)?.trim();
  return value || undefined;
}

function directChildren(parent: Element, tagName: string): Element[] {
  return Array.from(parent.children).filter(
    (child) => child.tagName.toLowerCase() === tagName.toLowerCase(),
  );
}

function descendants(parent: Element, tagName: string): Element[] {
  return Array.from(parent.getElementsByTagName(tagName));
}

function addColumn(
  columns: Map<string, OlapSchemaColumnView>,
  name: string | undefined,
  keyType?: OlapSchemaColumnView['keyType'],
) {
  if (!name) return;
  const existing = columns.get(name);
  columns.set(name, { name, keyType: keyType ?? existing?.keyType });
}

/** Convert Mondrian XML metadata into the read-only model diagram shape. */
export function parseMondrianSchema(xml: string): OlapSchemaViewModel {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) {
    const reason = parserError.textContent?.trim().replace(/\s+/g, ' ');
    throw new Error(
      reason
        ? `The schema XML could not be parsed: ${reason}`
        : 'The schema file does not contain valid XML.',
    );
  }

  const root = document.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'schema') {
    throw new Error('The XML does not have a <Schema> root element.');
  }

  const cube = descendants(root, 'Cube')[0];
  const schemaName = requiredAttribute(root, 'name') ?? 'Unnamed schema';
  const cubeName = cube
    ? (requiredAttribute(cube, 'name') ?? schemaName)
    : schemaName;
  const tableColumns = new Map<string, Map<string, OlapSchemaColumnView>>();
  const tableNames = new Set<string>();
  const primaryKeys = new Map<string, string>();
  const physicalSchema = descendants(root, 'PhysicalSchema')[0];

  if (physicalSchema) {
    for (const table of directChildren(physicalSchema, 'Table')) {
      const name = requiredAttribute(table, 'name');
      if (!name) continue;
      tableNames.add(name);
      const columns = new Map<string, OlapSchemaColumnView>();
      const key = descendants(table, 'Key')[0];
      for (const column of key ? descendants(key, 'Column') : []) {
        const columnName = requiredAttribute(column, 'name');
        addColumn(columns, columnName, 'primary');
        if (columnName) primaryKeys.set(name, columnName);
      }
      tableColumns.set(name, columns);
    }
  }

  const measureGroups = cube ? descendants(cube, 'MeasureGroup') : [];
  const factTableNames = new Set(
    measureGroups
      .map((group) => requiredAttribute(group, 'table'))
      .filter((name): name is string => Boolean(name)),
  );
  const cubeDimensionNames = new Set(
    (cube ? descendants(cube, 'Dimension') : [])
      .map((dimension) => requiredAttribute(dimension, 'source'))
      .filter((name): name is string => Boolean(name)),
  );

  for (const dimension of descendants(root, 'Dimension')) {
    const tableName = requiredAttribute(dimension, 'table');
    if (!tableName) continue;
    tableNames.add(tableName);
    if (!tableColumns.has(tableName)) tableColumns.set(tableName, new Map());
    const columns = tableColumns.get(tableName)!;
    for (const attribute of descendants(dimension, 'Attribute')) {
      addColumn(columns, requiredAttribute(attribute, 'keyColumn'));
      addColumn(columns, requiredAttribute(attribute, 'nameColumn'));
    }
  }

  const measures: OlapSchemaMeasureView[] = [];
  if (cube) {
    for (const measure of descendants(cube, 'Measure')) {
      const name = requiredAttribute(measure, 'name');
      if (!name) continue;
      const column = requiredAttribute(measure, 'column');
      const group = measureGroups.find((candidate) =>
        candidate.contains(measure),
      );
      const factTable = group ? requiredAttribute(group, 'table') : undefined;
      if (factTable) {
        tableNames.add(factTable);
        factTableNames.add(factTable);
        if (!tableColumns.has(factTable))
          tableColumns.set(factTable, new Map());
        addColumn(tableColumns.get(factTable)!, column);
      }
      measures.push({
        name,
        column,
        aggregator: requiredAttribute(measure, 'aggregator'),
      });
    }
  }

  const relationships: OlapSchemaRelationshipView[] = [];
  if (physicalSchema) {
    for (const [index, link] of descendants(physicalSchema, 'Link').entries()) {
      const source = requiredAttribute(link, 'source');
      const target = requiredAttribute(link, 'target');
      const foreignKey = descendants(link, 'ForeignKey')[0];
      const foreignKeyColumn = foreignKey
        ? requiredAttribute(descendants(foreignKey, 'Column')[0], 'name')
        : undefined;
      if (!source || !target || !foreignKeyColumn) continue;

      tableNames.add(source);
      tableNames.add(target);
      if (!tableColumns.has(source)) tableColumns.set(source, new Map());
      if (!tableColumns.has(target)) tableColumns.set(target, new Map());
      const primaryKey = primaryKeys.get(source);
      if (primaryKey)
        addColumn(tableColumns.get(source)!, primaryKey, 'primary');
      addColumn(tableColumns.get(target)!, foreignKeyColumn, 'foreign');
      relationships.push({
        id: `${source}-${target}-${index}`,
        source,
        target,
        sourceColumn: primaryKey ?? source,
        targetColumn: foreignKeyColumn,
      });
    }
  }

  const tables: OlapSchemaTableView[] = Array.from(tableNames).map((name) => ({
    id: name,
    name,
    role: factTableNames.has(name) ? 'fact' : 'dimension',
    columns: Array.from(tableColumns.get(name)?.values() ?? []),
  }));

  const dimensions: OlapSchemaDimensionView[] = descendants(root, 'Dimension')
    .filter((dimension) => requiredAttribute(dimension, 'name'))
    .map((dimension) => {
      const hierarchy = descendants(dimension, 'Hierarchy')[0];
      const attributes = descendants(dimension, 'Attribute')
        .map((attribute) => requiredAttribute(attribute, 'name'))
        .filter((name): name is string => Boolean(name));
      const levels = hierarchy
        ? descendants(hierarchy, 'Level')
            .map(
              (level) =>
                requiredAttribute(level, 'attribute') ??
                requiredAttribute(level, 'name'),
            )
            .filter((level): level is string => Boolean(level))
            .map(
              (level) =>
                attributes.find((attribute) => attribute === level) ?? level,
            )
        : [];
      return {
        name: requiredAttribute(dimension, 'name')!,
        hierarchy: hierarchy ? requiredAttribute(hierarchy, 'name') : undefined,
        levels,
      };
    })
    .filter(
      (dimension) =>
        cubeDimensionNames.size === 0 || cubeDimensionNames.has(dimension.name),
    );

  return { schemaName, cubeName, tables, relationships, dimensions, measures };
}
