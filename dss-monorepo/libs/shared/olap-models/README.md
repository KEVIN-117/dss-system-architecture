# OLAP models

Shared, framework-independent Saiku OLAP contracts and cellset helpers.

- `query.ts`: thin query, cellset, and query-result models.
- `dimensions.ts`: connection, catalog, cube, dimension, hierarchy, level, member, measure, and time-calculation models.
- `cellset-utils.ts`: cellset parsing, row labels, numeric extraction, leaf rows, and series-axis assignment.
- `cell-format.ts`: parser for Saiku/Mondrian formatted-cell markers.

The OLAP connector depends on this package for request/response types. Keep these models free of UI-framework imports and network clients.
