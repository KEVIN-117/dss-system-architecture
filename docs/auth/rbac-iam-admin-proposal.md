# Propuesta: gestionar usuarios, roles y permisos desde el admin-portal

> Estado: **implementada** (épica IAM #290, IAM-001 a IAM-019). Las decisiones D1–D4 rigen el modelo; el estado resultante está en [rbac-current-state.md](rbac-current-state.md). Las menciones a roles antiguos y a la convivencia son históricas: esos roles y flags se retiraron en IAM-019.

## Objetivo

Que el administrador gestione desde el admin-portal, sin abrir la consola de Keycloak:

- clientes
- usuarios
- roles
- permisos
- asignaciones (usuario ↔ rol, rol ↔ permiso)

Además, crear un permiso nuevo no debe requerir desplegar código.

## Principios

- **Keycloak sigue siendo la fuente de verdad** de la identidad, los roles y las asignaciones.
- **auth-service** es la única pieza que habla con la Admin REST API. Aplica las reglas institucionales y guarda la auditoría.
- **El BFF** expone las operaciones con sesión y autorización por permiso. El navegador nunca ve tokens de administración.
- **El contexto académico** (facultad/carrera) se queda en la base de datos de auth-service.

## Modelo propuesto

| Concepto DSS | Representación en Keycloak | Ejemplo |
|---|---|---|
| Permiso | Rol de cliente en un cliente catálogo, con nombre `recurso:acción` y descripción | `users:write`, `analytics:faculty`, `dw:closure:manage` |
| Rol | Rol compuesto del realm que agrupa permisos | `DECANO` = {`analytics:read`, `analytics:faculty`, …} |
| Usuario | Usuario con roles del realm (y, si hace falta, permisos sueltos) | — |
| Aplicación | Cliente de Keycloak | `dss-bff`, `olap-service` |

- **Permiso nuevo:** se crea un rol de cliente y se añade a los compuestos que correspondan, sin desplegar.
- **Cómo se comprueba un permiso:** el código pregunta por un permiso concreto (`requirePermissions(['users:write'])`), nunca por un nombre de rol.
- **Roles con portal** (a qué dashboard se redirige): un atributo del rol en Keycloak (`portal=rector`), en lugar del enum `DSSRole`.

## Fases

1. **Base técnica**
   - Añadir a auth-service un adaptador `adapter/out/keycloak/` (con `keycloak-admin-client` o `RestClient`) que obtenga su token con `client_credentials` sobre `uatf-auth-service`.
   - Dar a la cuenta de servicio solo `view-users`, `manage-users`, `view-clients`, `manage-clients`, `query-groups` y `view-realm`.
   - Pasar el secreto del realm a `${KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET}` y vigilarlo con el test de secretos.
   - Crear una tabla `admin_audit_log` (quién, qué, objetivo, antes/después, IP, cuándo).
2. **Usuarios**
   - Crear e invitar (acción requerida `UPDATE_PASSWORD` por correo) y activar o desactivar.
   - Asignar y quitar roles y permisos.
   - Reutilizar el panel de contexto actual, pero con varios contextos.
3. **Roles y permisos**
   - Hacer CRUD de roles del realm y de permisos.
   - Mostrar una matriz rol × permiso, que edita los compuestos.
4. **Clientes**
   - Listar, crear, editar, activar o desactivar y rotar el secreto.
   - Proteger los clientes de sistema (`dss-bff`, `uatf-auth-service`, `realm-management`…).
5. **Quitar lo fijo en el código**
   - Calcular los permisos en el BFF a partir del token, en lugar de `ROLE_PERMISSIONS`.
   - Usar `requirePermissions` en las rutas.
   - Hacer que `JwtConverter` y `SyncUserService` lean los roles igual.
   - Hacer que el webhook mande los roles efectivos, los borrados de usuario y los cambios en los compuestos.
6. **UI en el admin-portal**
   - Secciones Usuarios, Roles, Permisos, Clientes y Auditoría.
   - Todas pasan por `/api/admin/iam/**` en el BFF.

## Decisiones tomadas (2026-11-19)

| # | Tema | Decisión | Consecuencias |
|---|---|---|---|
| D1 | Dónde viven los permisos | **Cliente catálogo único `dss-permissions`** (bearer-only). Todos los permisos son roles de este cliente | El claim único es `resource_access.dss-permissions.roles`. Hay que adaptar `DwControlJwtAuthenticationConverter` (`DW_*` → `dw:closure:read`, …), `SaikuKeycloakJwtAuthenticationConverter` (`olap:admin` → ROLE_ADMIN), prediction-service y `JwtConverter`. Durante la migración, los roles antiguos y los nuevos conviven |
| D2 | Estructura institucional | **El contexto académico se queda en auth-service** (`user_academic_contexts` y el catálogo de Hop). No se usan grupos de Keycloak | Se elimina el límite de un contexto por usuario (por ejemplo, un decano interino de dos facultades). El filtro de alcance del BFF y de prediction-service sigue igual |
| D3 | Administradores delegados | **No por ahora.** Solo administran los usuarios con permisos `iam:*`. FGAP queda desactivado | Permisos nuevos: `iam:users:read`, `iam:users:write`, `iam:roles:read`, `iam:roles:write`, `iam:clients:read`, `iam:clients:write`, `iam:audit:read`. SUPERADMIN los tiene todos. auth-service los comprueba con `@PreAuthorize("hasAuthority('iam:…')")` |
| D4 | Limpieza del realm | 1) **Eliminar `uatf-dss-spa`**. 2) **Quitar `olap-service:OLAP_ADMIN` del compuesto SUPERADMIN** y crear el permiso aparte `olap:admin`. 3) **Unificar el nombre del realm** como `uatf-dss-realm` en `.env.example` y `keycloak_specification.md` | Comprobar antes de eliminar `uatf-dss-spa` que el token de `dss-bff` sigue incluyendo `uatf-auth-service` en `aud` (lo agrega el mapper *audience resolve* por los roles de cliente). Si no, añadir un audience mapper a `dss-bff`. Quien administre Saiku necesitará que se le asigne `olap:admin` |

### Catálogo inicial de permisos (`dss-permissions`)

| Permiso | Sustituye a | Roles que lo incluyen |
|---|---|---|
| `analytics:read` | `analytics:read` (TS) | DIRECTOR, DECANO, RECTOR |
| `analytics:career` | `analytics:career` (TS) | DIRECTOR, DECANO, RECTOR |
| `analytics:faculty` | `analytics:faculty` (TS) | DECANO, RECTOR |
| `analytics:global` | `analytics:global` (TS) | RECTOR |
| `pipelines:read` / `pipelines:execute` | TS | DECANO, RECTOR / SUPERADMIN |
| `connectors:read` / `connectors:write` | TS | RECTOR / SUPERADMIN |
| `prediction:train` | `requireRoles(['SUPERADMIN'])` en `/api/prediction` | SUPERADMIN |
| `olap:admin` | `olap-service:OLAP_ADMIN` | ninguno por defecto |
| `olap:user` | `olap-service:OLAP_USER` | ninguno por defecto |
| `dw:closure:read` / `dw:closure:manage` / `dw:etl-monitor:read` | `DW_*` de `dw-control-service` | ninguno por defecto; se asignan por usuario |
| `context:read` | `uatf-auth-service:CONTEXT_READER` | cuenta de servicio de `olap-service` |
| `iam:*` (D3) | `users:read` / `users:write` (TS) | SUPERADMIN |

La jerarquía RECTOR ⊃ DECANO ⊃ DIRECTOR deja de estar en `ROLE_HIERARCHY` y pasa a expresarse en los compuestos de Keycloak. Los roles antiguos de `uatf-auth-service` se retiran cuando todos los servicios lean `dss-permissions`.

## Verificación

- auth-service: pruebas de integración con Testcontainers Keycloak para cada operación de la Admin API, y prueba de que escribe la auditoría.
- BFF: pruebas con vitest de la resolución de permisos y de los guards.
- admin-portal-e2e: pruebas de Playwright del flujo crear permiso → asignarlo a un rol → asignar el rol a un usuario.
- Prueba manual en Docker: el permiso nuevo aparece en el JWT y se aplica sin redesplegar.
