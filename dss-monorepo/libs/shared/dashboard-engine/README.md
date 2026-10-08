# Dashboard Engine

Framework-independent dashboard state and URL helpers for the OLAP workspace and portal dashboards.

## State and layout

`createDashboardState(dashboardId)` creates an empty dashboard state with responsive layout slots. `dashboardReducer` updates the layout for a breakpoint, adds or clears cross-filters, or replaces the state. Layout items use grid coordinates so the UI can adapt them to `react-grid-layout` without making the shared engine depend on a rendering library.

## Cross-filters

Create filters from a tile selection with `createCrossFilter` or update a filter set with `setCrossFilter`. Values within a filter are ORed, while active filters are ANDed. `matchesCrossFilters` applies those rules to a row and skips the originating tile's own filter.

## URL synchronization

`readDashboardStateFromUrl` parses the `dssDashboard` query parameter and ignores malformed state. `serializeDashboardStateToUrl` updates that parameter while preserving the rest of the URL. In a browser, `syncDashboardStateToUrl` writes using `history.replaceState` by default; pass `{ mode: 'push' }` to create a history entry. Browser globals are accessed only when this helper is called, so the rest of the package remains safe to use in server-rendered code.
