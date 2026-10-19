# Contrato de analítica GraphQL del BFF

El endpoint `GET|POST /api/graphql` entrega metadatos y consultas OLAP a los portales. Requiere una sesión BFF válida (cookie HttpOnly) o una credencial Bearer aceptada por el guard del BFF. El navegador llama al BFF; la URL privada del OLAP y el token de acceso permanecen en el servidor.

## Campos disponibles

| Campo | Uso |
| --- | --- |
| `viewer` | Identidad, roles y alcance académico validado por el BFF/Auth Service. |
| `olapCubes` | Lista los cubos que el principal autenticado puede ver en OLAP. |
| `olapCubeSchema(cubeId)` | Devuelve el esquema vigente de ese cubo, incluidas sus medidas, dimensiones, jerarquías y niveles. |
| `analyticQuery(input)` | Ejecuta una consulta de registros contra un cubo visible. Los nombres de medidas y ejes se obtienen del esquema vivo; el contrato no mantiene un catálogo duplicado. |

`cubeId` es `connectionName/catalog/schema/cubeName`, igual al identificador que entrega `olapCubes`.

## Consulta de descubrimiento

```graphql
query AnalyticsCatalog {
  viewer {
    id
    displayName
    roles
    academicScope { kind facultyIds careerIds }
  }
  olapCubes {
    cubeId
    cubeCaption
    defaultMeasure
    measureCount
  }
}
```

El portal debe consultar `olapCubeSchema(cubeId)` y construir las opciones de medidas/dimensiones a partir de esa respuesta. Así, los indicadores visibles siguen el catálogo que OLAP realmente tiene publicado. Los nombres de métricas que se usarán en las portadas se acuerdan con las issues de cada dashboard y el modelo DW/OLAP antes de fijar sus vistas.

## Ejecutar una consulta

```graphql
query AcademicSummary($input: AnalyticQueryInput!) {
  analyticQuery(input: $input) {
    status
    data
    metadata
    totalRows
    runtimeMs
  }
}
```

```json
{
  "input": {
    "cubeId": "connection/catalog/schema/cubeName",
    "measures": [{ "name": "<medida publicada por el cubo>" }],
    "rows": [{ "dimension": "<dimensión>", "hierarchy": "<jerarquía>", "level": "<nivel>" }],
    "filters": [{
      "dimension": "<dimensión publicada>",
      "level": "<nivel publicado>",
      "op": "IN",
      "members": ["<miembro publicado>"]
    }],
    "limit": 100
  }
}
```

`rows`, `columns`, `filters` y `order` son opcionales. `CubeFilterOperator` permite `IN`, `NOT_IN`, `BETWEEN`, `DESCENDANTS_OF` y `RELATIVE`; `SortDirection` permite `ASC` y `DESC`. El límite máximo de la respuesta es 500 registros. OLAP valida que medidas, dimensiones, niveles y miembros existan en el schema vigente.

## Seguridad de ámbito

El BFF calcula el alcance a partir de roles y `academicContexts` de la sesión validada. Rector consulta el ámbito institucional; Decano queda limitado a sus facultades; Director queda limitado a sus carreras. Para roles con alcance, el servidor agrega el filtro configurado en `OLAP_ACADEMIC_SCOPE_FILTERS` y rechaza si el cliente trata de seleccionar o filtrar la dimensión protegida. El input GraphQL no incluye `scope`, `facultyId`, `careerId` ni `contextId`.

El conector `@dss-monorepo/olap-connector/server` es la única ruta de estos resolvers hacia OLAP. Envía el JWT en una solicitud servidor-a-servidor, sin persistirlo ni incluirlo en el resultado GraphQL.

## Errores normalizados

Los errores se exponen como `errors[].extensions.code`; el mensaje no incluye el cuerpo interno de OLAP.

| Código | Significado |
| --- | --- |
| `UNAUTHENTICATED` | No existe sesión o token aceptado. |
| `FORBIDDEN`, `ACADEMIC_CONTEXT_REQUIRED` | El rol no tiene permiso analítico o falta el contexto académico requerido. |
| `CUBE_FORBIDDEN` | Cubo no visible para el principal o fuera del catálogo accesible. |
| `INVALID_ARGUMENT`, `SCOPE_FILTER_IMMUTABLE` | Argumentos inválidos o intento de cambiar el filtro de alcance del servidor. |
| `OLAP_INVALID_QUERY` | OLAP rechazó medidas, campos, niveles o miembros. Incluye `field` y `available` seguros cuando los envía el servicio. |
| `OLAP_TIMEOUT` | El transporte o la consulta agotó su tiempo. |
| `OLAP_FORBIDDEN`, `OLAP_RATE_LIMITED` | OLAP denegó la operación o limitó la frecuencia. |
| `OLAP_UNAVAILABLE`, `OLAP_QUERY_FAILED` | Servicio no disponible o fallo de ejecución normalizado. |

## Configuración del mapa académico

`OLAP_ACADEMIC_SCOPE_FILTERS` contiene la correspondencia entre IDs validados por Auth Service y miembros del cubo. Los valores deben coincidir con las dimensiones/jerarquías/niveles cargados en Saiku; una configuración incompleta falla cerrada con `SCOPE_CONFIGURATION_ERROR`. La definición local del cubo académico está en [`infra/olap/schemas/uatf-rendimiento-academico.xml`](../../infra/olap/schemas/uatf-rendimiento-academico.xml) y el datasource de referencia en [`infra/olap/datasources/uatf-dw.sds`](../../infra/olap/datasources/uatf-dw.sds). Esos archivos deben publicarse en el repositorio Saiku de cada entorno antes de que los portales puedan descubrir el cubo y ejecutar consultas sobre él.
