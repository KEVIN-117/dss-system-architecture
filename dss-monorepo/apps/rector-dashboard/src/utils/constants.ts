export const CUBES_QUERY = `query RectorCubes {
  olapCubes { cubeId cubeName cubeCaption }
}`;
export const SCHEMA_QUERY = `query RectorCubeSchema($cubeId: ID!) {
  olapCubeSchema(cubeId: $cubeId)
}`;
export const MEMBERS_QUERY = `query RectorCubeMembers($cubeId: ID!, $dimension: String!, $hierarchy: String!, $level: String!, $limit: Int) {
  olapCubeMembers(cubeId: $cubeId, dimension: $dimension, hierarchy: $hierarchy, level: $level, limit: $limit) { name uniqueName caption }
}`;
export const ANALYTIC_QUERY = `query RectorAnalyticQuery($input: AnalyticQueryInput!) {
  analyticQuery(input: $input) { status data totalRows runtimeMs }
}`;
export const CARD_CLASS =
  'border border-border bg-card shadow-none ring-0 backdrop-blur-none';