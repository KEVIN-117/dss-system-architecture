# BFF de autenticación

El BFF es el único punto de integración de los portales con Keycloak y `auth-service`. Implementa Authorization Code con PKCE: el navegador inicia el flujo en el BFF, Keycloak muestra su tema de inicio de sesión y el callback del BFF intercambia el código en servidor. El navegador nunca recibe un token, un secreto OIDC ni la URL de `auth-service`.

## Rutas

- `GET /api/auth/login`: crea una transacción cifrada con `state`, `nonce` y PKCE; después redirige a Keycloak. Acepta `returnTo` solo para orígenes de `BFF_ALLOWED_ORIGINS` y `action=register` cuando el realm permita registro.
- `GET /api/auth/callback`: valida `state`, intercambia el código, valida ID token y access token, consulta el perfil activo y emite `dss_session`.
- `GET /api/auth/me`: devuelve perfil, roles y permisos efectivos desde una sesión BFF válida.
- `GET /api/auth/logout`: elimina la sesión BFF y redirige al logout OIDC si tiene un ID token disponible.
- `PUT /api/admin/users/:userId/academic-contexts`: reemplaza los contextos académicos del usuario. Requiere `SUPERADMIN` en el BFF y conserva la validación `ROLE_SUPERADMIN` de `auth-service` como segunda barrera.
- `/api/admin/dw/academic-closures*`: fachada autenticada de cierres académicos, historial y transiciones. Requiere el rol correspondiente (`DW_CLOSURE_READ` o `DW_CLOSURE_MANAGE`) del cliente `dw-control-service`; el BFF reenvía el JWT verificado y el servicio conserva el `sub` para auditoría.
- `/api/admin/dw/etl/executions*`: consulta paginada y detalle de ejecuciones ETL. Requiere `DW_ETL_MONITOR_READ` del cliente `dw-control-service`. El BFF valida y normaliza respuestas y no propaga cuerpos de error del servicio.
- `GET|POST /api/graphql`: endpoint Apollo Server protegido por la misma sesión BFF o Bearer token. Expone identidad y alcance académicos, catálogo/metadatos OLAP, `analyticQuery` y `predictionPublication` para consultar la publicación vigente del Prediction Service. Los resolvers llaman a los servicios con el token validado; los tokens nunca forman parte de la respuesta.
- `/api/olap/rest/saiku/*`: proxy autenticado a `olap-service`, incluido su endpoint GraphQL real en `/api/olap/rest/saiku/api/graphql`. El BFF valida la sesión y reenvía el access token; las rutas `/rest/saiku/admin/*` requieren además el rol `SUPERADMIN`. Keycloak debe incluir la audiencia `olap-service` en los tokens solicitados por `dss-bff`.
- `/api/prediction/v1/predictions`, `/api/prediction/v1/training-jobs*`, `/api/prediction/v1/prediction-batches*`, `/api/prediction/v1/prediction-publications` y `/api/prediction/v1/academic-options`: fachada autenticada para inferencia, entrenamiento, publicación y carga de programas/cierres autorizados. El BFF valida la sesión y reenvía el token a Prediction Service; el servicio vuelve a validar identidad, permiso y ámbito académico. El navegador no accede al worker ni al DW.

La cookie de sesión es `HttpOnly`, `SameSite=Lax`, `Secure` en producción y contiene un JWE que solo puede descifrar el BFF. No persiste el refresh token. Las rutas vuelven a validar el access token, issuer, audiencia y perfil activo; los endpoints de negocio deben además aplicar `requireRoles()` o `requirePermissions()`.

El JWE stateless es la implementación inicial y funciona sin una base de sesiones. Para despliegues con varias instancias o revocación inmediata se puede evolucionar a un identificador opaco respaldado por Redis o una base de datos; esa migración no cambia el contrato de los portales. En producción se deben rotar `BFF_SESSION_SECRET` y `KEYCLOAK_BFF_CLIENT_SECRET`, usar HTTPS y mantener una lista explícita de orígenes.

## Configuración

Configura `apps/bff/.env` a partir de `.env.example`:

```dotenv
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=uatf-dss-realm
KEYCLOAK_AUDIENCE=uatf-auth-service
KEYCLOAK_ROLE_CLIENT_ID=uatf-auth-service
KEYCLOAK_BFF_CLIENT_ID=dss-bff
KEYCLOAK_BFF_CLIENT_SECRET=<secreto-no-versionado>
KEYCLOAK_BFF_REDIRECT_URI=http://localhost:3006/api/auth/callback
KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/login
AUTH_SERVICE_URL=http://localhost:8000
PREDICTION_SERVICE_URL=http://prediction-service:8000
OLAP_SERVICE_URL=http://olap-service:8080
DW_CONTROL_SERVICE_URL=http://dw-control-service:8090
DW_CONTROL_SERVICE_TIMEOUT_MS=15000
BFF_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004
BFF_DEFAULT_POST_LOGIN_REDIRECT_URI=http://localhost:3000/auth/callback
BFF_SESSION_SECRET=<al-menos-32-caracteres-no-versionados>
```

Las consultas con ámbito de facultad o carrera requieren configurar `OLAP_ACADEMIC_SCOPE_FILTERS` como JSON en el runtime privado del BFF. El mapa local corresponde al cubo UATF versionado en [`infra/olap/schemas/uatf-rendimiento-academico.xml`](../../../infra/olap/schemas/uatf-rendimiento-academico.xml). `faculty` usa el identificador `facultyId` de Auth Service contra el nivel Facultad; `career` usa `careerId` contra el nivel Carrera. Las dimensiones de alcance son separadas de `Academic Program` para que el filtro impuesto por el BFF no choque con los niveles que el usuario consulta en filas o columnas.

```json
{
  "faculty": {
    "dimension": "Academic Faculty Scope",
    "hierarchy": "Faculty Scope",
    "level": "Faculty",
    "memberTemplate": "[Academic Faculty Scope].[Faculty Scope].[Faculty].&[{id}]"
  },
  "career": {
    "dimension": "Academic Career Scope",
    "hierarchy": "Career Scope",
    "level": "Career",
    "memberTemplate": "[Academic Career Scope].[Career Scope].[Career].&[{id}]"
  }
}
```

El esquema Mondrian usa la tabla de hechos `dw.fact_cursado` y las dimensiones `dw.dim_programa` y `dw.dim_periodo_academico`. El descriptor sin credenciales está en [`infra/olap/datasources/uatf-dw.sds`](../../../infra/olap/datasources/uatf-dw.sds). Para que Saiku resuelva el catálogo, el despliegue instala el XML y el descriptor en `<saiku-home>/repository/data/unknown/datasources/` y suministra las credenciales JDBC por `<saiku-home>/conf/datasources.properties`. El inicializador Compose mantiene estos archivos y construye la URL JDBC a partir de `POSTGRES_DW_NAME` en el volumen persistente. La definición del cubo no carga datos ni crea las tablas del DW.

El BFF deriva el alcance desde los roles y `academicContexts` validados, agrega el filtro de seguridad al servidor y rechaza argumentos que pretendan seleccionar la jerarquía protegida. Rector usa alcance institucional. No se declaran nombres de indicadores ni medidas ficticios: el catálogo y el schema se obtienen del OLAP activo y la consulta solo admite las medidas/campos que el propio servicio valida. Predicciones y ML siguen fuera de esta integración.

La URL `http://prediction-service:8000` aplica cuando BFF y Prediction Service comparten la red `dss-net`; configura una dirección alcanzable desde el runtime del BFF en desarrollo local. Las rutas de inferencia individual y publicación poblacional siguen el contrato [prediction-api-v1.yaml](../../../docs/prediction/contracts/prediction-api-v1.yaml). Los permisos de consulta se aplican en el servicio predictivo; iniciar un lote requiere además configurar explícitamente `PREDICTION_BATCH_SUBMITTER_ROLES`.

`DW_CONTROL_SERVICE_URL` es privada y debe apuntar a una dirección alcanzable desde el proceso BFF (`http://localhost:8090` al ejecutar localmente, o `http://dw-control-service:8090` en una red de contenedores compartida). El timeout opcional acepta 1000–60000 ms. El BFF necesita que Keycloak incluya la audiencia `dw-control-service` y roles del cliente `dw-control-service` en el access token. Asigna esos roles explícitamente a las cuentas/grupos autorizados; el BFF falla cerrado cuando falta el rol requerido y dw-control-service lo vuelve a validar.

### Ejecución local

El flujo de login necesita que `auth-service` esté disponible: después de validar los tokens, el callback consulta `/api/v1/auth/me` para confirmar que el perfil exista y esté activo. `nx run-many -t dev --projects="tag:type:app,tag:type:bff"` no inicia este servicio Spring. Desde la raíz de `dss-system-architecture`, inicia `auth-service` y sus dependencias con:

```bash
docker compose up -d auth-service
```

Luego inicia los portales y el BFF con Nx. Si el callback vuelve a fallar, los logs del BFF indican la etapa del fallo sin registrar códigos, cookies ni tokens.

Los URI de callback, logout y los orígenes deben coincidir con el cliente confidencial `dss-bff` del realm. En producción se usan URL HTTPS y secretos distintos por entorno. El import del realm ocurre solo en una instalación nueva de Keycloak; los entornos existentes deben actualizar su cliente y tema mediante migración administrativa equivalente.

No existe una ruta de intercambio de tokens para el navegador. El único flujo soportado es `/api/auth/login` y su callback OIDC; los portales nunca reciben ni envían access tokens. Los callers de servidor de confianza pueden usar el encabezado Bearer en las rutas protegidas del BFF cuando su contrato lo requiera.

Las consultas GraphQL requieren una sesión válida y respetan `BFF_ALLOWED_ORIGINS` para CORS. El contrato completo, filtros, códigos de error y ejemplos están en [`docs/graphql/bff-analytics.md`](../../../docs/graphql/bff-analytics.md). Ejemplo de catálogo autenticado desde un portal con cookie de sesión:

```graphql
query AnalyticsHome {
  viewer {
    username
    roles
    academicScope {
      kind
      facultyIds
      careerIds
    }
  }
  olapCubes {
    cubeId
    cubeCaption
    defaultMeasure
  }
}
```

Una vez identificado el cubo, el portal puede llamar a `olapCubeSchema(cubeId)` para mostrar solo las medidas y dimensiones disponibles. `analyticQuery` recibe `cubeId`, medidas, ejes, filtros de análisis y orden; no acepta un `scope` ni un `contextId`. El BFF ya tiene el mapa local de facultad/carrera; las consultas de esos ámbitos funcionarán cuando Saiku cargue el catálogo con los nombres del XML.

## Verificación E2E

Las suites E2E usan una configuración aislada y valores de prueba. Cubren la entrada `/login`, el rechazo de dashboards sin sesión, la redirección OAuth con PKCE y la respuesta `401` de `/api/auth/me`. No realizan un login real en Keycloak ni contienen secretos de despliegue.

```bash
bun nx run-many -t e2e
```
