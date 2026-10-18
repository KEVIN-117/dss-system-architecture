# `@dss-monorepo/olap-connector`

Conector tipado de los portales con Saiku/`olap-service`. Incluye consultas
OLAP, Arrow IPC, dashboards, aplicaciones, administración y GraphQL.

## Autenticación y flujo de red

El conector no lee tokens ni secretos y no llama directamente al servicio desde
el navegador. `olapFetch` envía las solicitudes con las credenciales de sesión
al proxy del BFF:

```text
Portal ── cookie HttpOnly ──> BFF /api/olap/*
                                  │ valida sesión y JWT
                                  └── Bearer JWT ──> olap-service
```

El BFF valida issuer, firma, expiración y audiencia de autenticación antes de
reenviar el token. El cliente `dss-bff` de Keycloak incluye además la audiencia
`olap-service`; el servicio OLAP valida esa audiencia y sus propios roles
`OLAP_USER` / `OLAP_ADMIN`. Para el portal se configura `NEXT_PUBLIC_BFF_URL`;
en el servidor BFF, `OLAP_SERVICE_URL` apunta a la URL privada del servicio.

No se debe pasar `Authorization` desde el navegador ni exponer la URL privada
de `olap-service` en variables `NEXT_PUBLIC_*`.

## GraphQL de OLAP

GraphQL de Saiku se consume a través del proxy autenticado, en
`/api/olap/rest/saiku/api/graphql`. No es el endpoint GraphQL propio del BFF en
`/api/graphql`.

```ts
import {
  executeOlapGraphQL,
  fetchOlapGraphQLSchema,
} from '@dss-monorepo/olap-connector';

interface CubeListData {
  cubes: Array<{
    connectionName: string;
    catalog: string;
    schema: string;
    cubeName: string;
  }>;
}

const result = await executeOlapGraphQL<CubeListData>({
  query: `query VisibleCubes {
    cubes { connectionName catalog schema cubeName }
  }`,
});

if (result.errors?.length) {
  throw new Error(result.errors[0].message);
}

const runningSchema = await fetchOlapGraphQLSchema();
```

`executeOlapGraphQL` conserva el envelope estándar de GraphQL, incluyendo
respuestas parciales y errores, y permite pasar `variables`, `operationName`,
`extensions` (por ejemplo, APQ) y `AbortSignal`. Los tipos de respuesta se
parametrizan según el documento consultado, porque la SDL de OLAP cambia con los
cubos disponibles. `refreshOlapGraphQLSchema` solicita el refresco administrativo
del esquema; `olap-service` exige el rol `OLAP_ADMIN` para esa operación.

## Superficies disponibles

- Consultas síncronas/asíncronas, cancelación, drillthrough y negociación Arrow IPC.
- Administración de usuarios, datasources, esquemas y estadísticas del servicio.
- Dashboards: carga, guardado, imágenes, filtros, comentarios, historial y
  compartir.
- Aplicaciones de Saiku y modelos Ossie.
- GraphQL dinámico, lectura de SDL y refresco administrativo del esquema.

Los errores HTTP de autenticación `401` y autorización `403` notifican a los
listeners registrados con `onAuthFailure`. Si la sesión vuelve a estar
disponible, `notifySessionResumed` puede reanudar las operaciones pendientes que
se hayan registrado.
