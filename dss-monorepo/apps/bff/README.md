# BFF de autenticación

El BFF es el único punto de integración de los portales con Keycloak y `auth-service`. Implementa Authorization Code con PKCE: el navegador inicia el flujo en el BFF, Keycloak muestra su tema de inicio de sesión y el callback del BFF intercambia el código en servidor. El navegador nunca recibe un token, un secreto OIDC ni la URL de `auth-service`.

## Rutas

- `GET /api/auth/login`: crea una transacción cifrada con `state`, `nonce` y PKCE; después redirige a Keycloak. Acepta `returnTo` solo para orígenes de `BFF_ALLOWED_ORIGINS` y `action=register` cuando el realm permita registro.
- `GET /api/auth/callback`: valida `state`, intercambia el código, valida ID token y access token, consulta el perfil activo y emite `dss_session`.
- `GET /api/auth/me`: devuelve el perfil, los roles de portal y los permisos del token (`resource_access.dss-permissions.roles`) desde una sesión BFF válida.
- `POST /api/auth/refresh`: heartbeat de actividad de los portales; extiende la ventana de inactividad y devuelve los vencimientos de la sesión.
- `GET /api/auth/logout`: elimina la sesión BFF y redirige al logout OIDC si tiene un ID token disponible.
- `PUT /api/admin/users/:userId/academic-contexts`: reemplaza los contextos académicos del usuario. Requiere `iam:users:write` en el BFF, y `auth-service` vuelve a exigir el mismo permiso como segunda barrera. Las lecturas de `/api/admin/users*` y `/api/admin/academic-catalog` requieren `iam:users:read`.
- `/api/admin/dw/academic-closures*`: fachada autenticada de cierres académicos, historial y transiciones. Requiere `dw:closure:read` o `dw:closure:manage` de `dss-permissions`. El BFF reenvía el JWT verificado y el servicio conserva el `sub` para auditoría.
- `/api/admin/dw/etl/executions*`: consulta paginada y detalle de ejecuciones ETL. Requiere `dw:etl-monitor:read`. El BFF valida y normaliza respuestas y no propaga cuerpos de error del servicio.
- `/api/admin/dw/etl/{health,status,processes,launches*,schedules*}`: Load Manager (LM-006). Leer requiere `dw:etl-monitor:read`; lanzar y detener, `dw:etl:execute`; administrar programaciones, `dw:etl-schedule:manage`. Los cuerpos llegan con una allowlist de campos y las respuestas se validan en el connector. Hay dos excepciones a la regla de no propagar errores. Un 400 o 409 lleva `detail` con el motivo que dio dw-control-service, por ejemplo una programación dentro del horario de la DSA; el connector antes lo revisa en busca de datos internos. Un Hop Server caído responde 503 `HOP_UNAVAILABLE`.
- `/api/admin/iam/**`: administración IAM (usuarios, roles, permisos, aplicaciones y auditoría) hacia `auth-service` `/api/v1/admin/iam/**`. Ver [Administración IAM (IAM-015)](#administración-iam-iam-015).
- `GET|POST /api/graphql`: endpoint Apollo Server protegido por la misma sesión BFF o Bearer token. Expone identidad y alcance académicos, catálogo/metadatos OLAP, `analyticQuery` y `predictionPublication` para consultar la publicación vigente del Prediction Service. Los resolvers llaman a los servicios con el token validado; los tokens nunca forman parte de la respuesta.
- `/api/olap/rest/saiku/*`: proxy autenticado a `olap-service`, incluido su endpoint GraphQL real en `/api/olap/rest/saiku/api/graphql`. El BFF valida la sesión y reenvía el access token; las rutas `/rest/saiku/admin/*` requieren además el permiso `olap:admin`. Keycloak debe incluir la audiencia `olap-service` en los tokens solicitados por `dss-bff`.
- `/api/prediction/v1/predictions`, `/api/prediction/v1/training-jobs*`, `/api/prediction/v1/prediction-batches*`, `/api/prediction/v1/prediction-publications` y `/api/prediction/v1/academic-options`: fachada autenticada para inferencia, entrenamiento, publicación y carga de programas/cierres autorizados. El BFF valida la sesión y reenvía el token a Prediction Service; el servicio vuelve a validar identidad, permiso y ámbito académico. El navegador no accede al worker ni al DW.

La cookie de sesión es `HttpOnly`, `SameSite=Lax`, `Secure` en producción y contiene un JWE comprimido que solo puede descifrar el BFF, con el access token, el ID token y el refresh token de Keycloak.

### Renovación e inactividad

- El `proxy` del BFF renueva el access token (grant `refresh_token`) cuando le quedan menos de 60 s, reemite la cookie y reenvía la cookie nueva a la ruta. Las peticiones simultáneas con la misma cookie comparten un único refresh, y el resultado se reutiliza 30 s para peticiones que salieron antes de recibir la cookie nueva; esto también es compatible con la rotación de refresh tokens.
- La sesión vence por inactividad (`BFF_SESSION_IDLE_TIMEOUT_SECONDS`, 30 min) o por duración absoluta (`BFF_SESSION_MAX_LIFETIME_SECONDS`, 10 h), lo que ocurra primero, y nunca después del vencimiento del refresh token de Keycloak.
- Solo `POST /api/auth/refresh` cuenta como actividad. `AuthProvider` (`@dss-monorepo/auth`) lo envía al cargar la página y, como máximo una vez por minuto, cuando detecta teclado, puntero, rueda o scroll en cualquier pestaña del portal. Las llamadas de datos en segundo plano no mantienen viva la sesión.
- Dos minutos antes de vencer, `AuthProvider` muestra un aviso con cuenta regresiva (personalizable con `renderSessionWarning`, desactivable con `sessionTimeout={false}`); al vencer ejecuta el logout, que también cierra la sesión SSO.
- Si Keycloak rechaza el refresh token, el BFF borra la cookie y responde 401; si Keycloak no está disponible, la sesión sigue mientras el access token sea válido y después responde 503 sin borrarla. Las rutas vuelven a validar el access token, issuer, audiencia y perfil activo; los endpoints de negocio deben además aplicar `requirePermissions()`. `requireRoles()` queda solo para decisiones de portal.

El JWE stateless es la implementación inicial y funciona sin una base de sesiones. Para despliegues con varias instancias o revocación inmediata se puede evolucionar a un identificador opaco respaldado por Redis o una base de datos; esa migración no cambia el contrato de los portales. En producción se deben rotar `BFF_SESSION_SECRET` y `KEYCLOAK_BFF_CLIENT_SECRET`, usar HTTPS y mantener una lista explícita de orígenes.

## Configuración

Configura `apps/bff/.env` a partir de `.env.example`:

## Administración IAM (IAM-015)

`/api/admin/iam/<ruta>` corresponde uno a uno a `auth-service` `/api/v1/admin/iam/<ruta>`. Una sola ruta (`app/api/admin/iam/[...path]/route.ts`) aplica la tabla de `_lib/iam-operations.ts`. Para cada operación, el BFF:

1. exige la sesión y el permiso `iam:*` de la operación (auth-service lo vuelve a comprobar);
2. valida los identificadores de la ruta (UUID de usuario, nombre de rol, permiso `recurso:acción`, `clientId`), los parámetros de query declarados y el cuerpo, con los validadores de `@dss-monorepo/auth-models`; un campo que el contrato no define se rechaza;
3. reenvía el **access token del propio usuario**: el navegador nunca recibe un token administrativo;
4. responde con `Cache-Control: no-store`. Los secretos de cliente (alta y rotación) pasan una sola vez y nunca se registran.

| Ruta | Métodos | Permiso |
|---|---|---|
| `users` | POST | `iam:users:write` |
| `users/resync` | POST | `iam:users:write` |
| `users/{userId}` | PATCH | `iam:users:write` |
| `users/{userId}/actions-email` | POST | `iam:users:write` |
| `users/{userId}/roles`, `users/{userId}/permissions` | GET / PUT | `iam:users:read` / `iam:users:write` |
| `roles` | GET / POST | `iam:roles:read` / `iam:roles:write` |
| `roles/{name}` | GET / PATCH / DELETE (`?force=`) | `iam:roles:read` / `iam:roles:write` |
| `roles/{name}/permissions` | GET / PUT | `iam:roles:read` / `iam:roles:write` |
| `permissions` | GET / POST | `iam:roles:read` / `iam:roles:write` |
| `permissions/matrix` | GET | `iam:roles:read` |
| `permissions/{name}` | PATCH / DELETE (`?force=`) | `iam:roles:write` |
| `clients` | GET (`search`, `page`, `size`) / POST | `iam:clients:read` / `iam:clients:write` |
| `clients/{clientId}` | GET / PATCH | `iam:clients:read` / `iam:clients:write` |
| `clients/{clientId}/secret` | POST | `iam:clients:write` |
| `audit` | GET (`actor`, `action`, `targetType`, `targetId`, `outcome`, `from`, `to`, `page`, `size`) | `iam:audit:read` |

El directorio de usuarios sigue en `/api/admin/users`. Errores uniformes:

- un 4xx de auth-service conserva su estado y devuelve `{ error, code, detail }`, donde `code` y `detail` son el `title` y el mensaje de dominio de su ProblemDetail;
- un 5xx, una indisponibilidad o un timeout devuelven 502, 503 o 504 sin el cuerpo de auth-service;
- una ruta o un método desconocidos devuelven 404;
- un identificador, un query, un JSON o un cuerpo inválidos devuelven 400 con `code` `INVALID_PARAMETER`, `INVALID_QUERY`, `INVALID_JSON` o `INVALID_BODY`.

## Permisos (IAM-014)

Los permisos salen del token (`resource_access.dss-permissions.roles`); el BFF ya no tiene un mapa fijo rol → permisos. Qué rol concede qué permiso se decide en Keycloak desde el admin-portal, así que un permiso nuevo funciona sin desplegar el BFF ni los portales.

| Ruta | Permiso |
|---|---|
| `GET /api/admin/users*`, `GET /api/admin/academic-catalog` | `iam:users:read` |
| `PUT /api/admin/users/:userId/academic-contexts` | `iam:users:write` |
| `/api/admin/dw/academic-closures*` | `dw:closure:read` / `dw:closure:manage` |
| `/api/admin/dw/etl/executions*` | `dw:etl-monitor:read` |
| `GET /api/admin/dw/etl/{health,status,processes,launches*,schedules*}` | `dw:etl-monitor:read` |
| `POST /api/admin/dw/etl/launches`, `POST .../launches/{id}/stop` | `dw:etl:execute` |
| `POST/PUT/DELETE /api/admin/dw/etl/schedules*` | `dw:etl-schedule:manage` |
| `/api/olap/rest/saiku/admin/*` | `olap:admin` |
| Resto de `/api/olap/**` y GraphQL de analítica | `analytics:read` + alcance (`analytics:global`/`faculty`/`career`), salvo `olap:admin` |
| Entrenamiento, datasets y modelos en `/api/prediction/**` | `prediction:train` |

Los **roles** solo deciden el portal (qué dashboard abre cada usuario). Un rol nuevo del realm no se descarta: se asigna a un portal con `KEYCLOAK_PORTAL_ROLES`. En los portales, `<Can permission…>`, `useCan` y `useMyPermissions` leen los permisos del token; `RoleGuard` y `usePermission` siguen basados en roles porque representan el portal.

```dotenv
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=uatf-dss-realm
KEYCLOAK_AUDIENCE=uatf-auth-service
KEYCLOAK_PERMISSIONS_CLIENT_ID=dss-permissions
# Opcional: roles nuevos del realm que abren un portal, por ejemplo {"VICERRECTOR":"RECTOR"}
KEYCLOAK_PORTAL_ROLES=
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

Las consultas con ámbito de facultad o carrera requieren configurar `OLAP_ACADEMIC_SCOPE_FILTERS` como JSON en el runtime privado del BFF. El mapa local corresponde al cubo UATF versionado en [`infra/olap/schemas/uatf-rendimiento-academico.xml`](../../../infra/olap/schemas/uatf-rendimiento-academico.xml). `faculty` usa el identificador `facultyId` de Auth Service contra el nivel Facultad; `career` usa `careerId` contra el nivel Carrera. Las dimensiones de alcance son separadas de `Programa` para que el filtro impuesto por el BFF no choque con los niveles que el usuario consulta en filas o columnas.

```json
{
  "faculty": {
    "dimension": "Ámbito de facultad",
    "hierarchy": "Facultad",
    "level": "Facultad",
    "memberTemplate": "[Ámbito de facultad].[Facultad].[Facultad].&[{id}]"
  },
  "career": {
    "dimension": "Ámbito de carrera",
    "hierarchy": "Carrera",
    "level": "Carrera",
    "memberTemplate": "[Ámbito de carrera].[Carrera].[Carrera].&[{id}]"
  }
}
```

El esquema Mondrian usa la tabla de hechos `dw.fact_cursado` y las dimensiones `dw.dim_programa` y `dw.dim_periodo_academico`. El descriptor sin credenciales está en [`infra/olap/datasources/uatf-dw.sds`](../../../infra/olap/datasources/uatf-dw.sds). Para que Saiku resuelva el catálogo, el despliegue instala el XML y el descriptor en `<saiku-home>/repository/data/unknown/datasources/` y suministra las credenciales JDBC por `<saiku-home>/conf/datasources.properties`. El inicializador Compose mantiene estos archivos y construye la URL JDBC a partir de `POSTGRES_DW_NAME` en el volumen persistente. La definición del cubo no carga datos ni crea las tablas del DW.

El BFF deriva el alcance desde los permisos del token (`analytics:read` más `analytics:global`, `analytics:faculty` o `analytics:career`) y los `academicContexts` validados, agrega el filtro de seguridad al servidor y rechaza argumentos que pretendan seleccionar la jerarquía protegida. Rector usa alcance institucional. No se declaran nombres de indicadores ni medidas ficticios: el catálogo y el schema se obtienen del OLAP activo y la consulta solo admite las medidas/campos que el propio servicio valida. Predicciones y ML siguen fuera de esta integración.

El proxy de Saiku aplica la misma política al OLAP Workspace: Rector consulta globalmente; Decano queda limitado a sus facultades y Director a sus carreras, siempre desde el perfil de Auth Service. Los perfiles académicos solo pueden leer el descubrimiento y metadatos de sus cubos y ejecutar consultas estructuradas; el BFF incorpora el miembro de alcance en el eje `FILTER`, rechaza MDX libre, filtros que intenten reemplazar ese alcance y operaciones alternas de consulta/dashboard. La medida interna `Conteo de privacidad` se oculta y no puede solicitarse desde portales. Sin contexto o con una configuración de alcance inválida, el BFF deniega la consulta. El acceso administrativo a Saiku sigue al permiso `olap:admin`, que no queda limitado a un alcance académico; `SUPERADMIN` sin `olap:admin` ni permisos `analytics:*` no tiene acceso a datos (D4).

Rectoría, Decanato y Dirección incorporan el explorador OLAP en la ruta `/analisis-olap` de cada portal. El BFF aplica el alcance académico correspondiente al usuario autenticado.

La URL `http://prediction-service:8000` aplica cuando BFF y Prediction Service comparten la red `dss-net`; configura una dirección alcanzable desde el runtime del BFF en desarrollo local. Las rutas de inferencia individual y publicación poblacional siguen el contrato [prediction-api-v1.yaml](../../../docs/prediction/contracts/prediction-api-v1.yaml). Los permisos de consulta se aplican en el servicio predictivo; iniciar un lote requiere además configurar explícitamente `PREDICTION_BATCH_SUBMITTER_ROLES`.

`DW_CONTROL_SERVICE_URL` es privada y debe apuntar a una dirección alcanzable desde el proceso BFF (`http://localhost:8090` al ejecutar localmente, o `http://dw-control-service:8090` en una red de contenedores compartida). El timeout opcional acepta 1000–60000 ms. El BFF necesita que Keycloak incluya la audiencia `dw-control-service` (mapper explícito de `dss-bff`) y los permisos `dw:*` de `dss-permissions` en el access token. Asigna esos roles explícitamente a las cuentas/grupos autorizados; el BFF falla cerrado cuando falta el rol requerido y dw-control-service lo vuelve a validar.

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
