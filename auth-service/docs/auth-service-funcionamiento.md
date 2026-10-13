# Funcionamiento interno de `auth-service`

**Revisión del código: 12 de octubre de 2026**

## Alcance

Este informe resume la implementación encontrada en el código de `auth-service` y su integración directa con el Event Listener SPI de Keycloak. Se revisaron controladores, casos de uso, modelo de dominio, seguridad, adaptadores de persistencia y mensajería, migraciones, perfiles de configuración, pruebas existentes y cambios recientes. También se consultaron el publisher del módulo `keycloak-webhook` y los archivos de Apache Hop que mantienen el catálogo académico local.

No se leyeron valores de `.env`, no se modificó código de aplicación y no se ejecutaron pruebas. Las rutas, propiedades y procesos descritos son evidencia del código; no se verificó el despliegue en vivo.

## Resumen ejecutivo

`auth-service` es un servicio Java 21 con Spring Boot y arquitectura hexagonal. Sus responsabilidades actuales son:

1. Validar JWT emitidos por Keycloak como OAuth2 Resource Server y entregar un perfil local asociado al `sub` del token.
2. Sincronizar perfiles y una selección de roles desde eventos administrativos de Keycloak transportados por RabbitMQ.
3. Administrar los contextos académicos de un usuario, con autorización `SUPERADMIN`, validación por rol y referencias a facultades y programas activos.

El inicio de sesión sigue ocurriendo en Keycloak. `auth-service` no contiene un endpoint de login ni llama a Keycloak Admin API para consultar usuarios. La sincronización ya no usa `POST /auth/sync`: se realiza en segundo plano por la cola `keycloak.user.events`.

## Tecnologías y arranque

- Java 21 y Spring Boot 4.1.0; Spring MVC, Spring Security, OAuth2 Resource Server, Spring Data JPA y Spring AMQP.
- PostgreSQL como base local IAM; Flyway aplica las migraciones y Hibernate está en modo `validate`.
- MapStruct para mapear entidades y dominio, y `springdoc-openapi` para documentar la API.
- RabbitMQ para recibir eventos de usuarios. El servicio declara una cola durable y una dead-letter queue (DLQ).
- El `Dockerfile` construye con Temurin 21 y ejecuta con JRE Alpine bajo un usuario no root.

El contexto servlet por defecto es `/api/v1` y el puerto es `8080`. `SPRING_PROFILE_ACTIVE` selecciona el perfil, cuyo valor predeterminado es `dev`. Los perfiles `dev` y `prod` configuran PostgreSQL y el issuer de Keycloak; el perfil productivo toma las credenciales de variables de entorno y exige que los orígenes CORS permitidos usen HTTPS. No se inspeccionaron los valores de esas variables.

`SecurityConfig` crea un `JwtDecoder` Nimbus a partir de `KEYCLOAK_JWK_SET_URI`. La validación comprueba firma, `issuer`, audiencia y vigencia. El decodificador usa tiempos de conexión y lectura de cinco segundos para obtener claves. La configuración productiva declara `issuer-uri` pero no `jwk-set-uri`; este último se suministra directamente al bean mediante `KEYCLOAK_JWK_SET_URI`.

## Organización interna

El servicio aplica Ports and Adapters:

- **Dominio (`domain`)**: modelos `User`, `Email`, `Role`, `UserAcademicContext`, el enum `RoleType`, validadores y excepciones. Define reglas de correo, identificadores y contextos académicos sin depender de Spring ni de JPA.
- **Aplicación (`application`)**: puertos de entrada/salida, comandos y servicios para consultar perfiles, sincronizar usuarios, asignar contextos y registrar usuarios de ejemplo.
- **Adaptadores de entrada (`adapter/in`)**: API REST y consumidor AMQP. Los controladores delegan en casos de uso; el consumidor convierte el mensaje de Keycloak en un comando.
- **Adaptadores de salida (`adapter/out`)**: persistencia con Spring Data JPA, MapStruct y JDBC. Incluye acceso a usuarios/roles/contextos, catálogo académico y bandeja de eventos procesados.
- **Configuración (`configuration`)**: composición de casos de uso, validación JWT, CORS, RabbitMQ, Flyway, OpenAPI y auditoría.

Las pruebas incluyen reglas ArchUnit para conservar la separación de dependencias, además de pruebas unitarias y de integración. No se ejecutaron durante esta revisión.

## Seguridad y API REST

Las rutas combinan el contexto `/api/v1` con los mappings de cada controlador:

| Ruta | Acceso | Función |
|---|---|---|
| `GET /api/v1/auth/me` | JWT válido | Devuelve el perfil local del `sub` y sus contextos académicos. |
| `PUT /api/v1/admin/users/{userId}/academic-contexts` | JWT con `ROLE_SUPERADMIN` | Reemplaza los contextos académicos del usuario indicado por su UUID local. |
| `GET /api/v1/demo/public` | Pública | Ruta demostrativa. |
| `GET /api/v1/demo/admin` | JWT y `SUPERADMIN` | Comprueba el control de acceso por rol. |
| `GET /api/v1/demo/rector` | JWT y `RECTOR` | Comprueba el control de acceso por rol. |
| `GET /api/v1/demo/decano` | JWT y `DECANO` | Comprueba el control de acceso por rol. |
| `GET /api/v1/demo/director` | JWT y `DIRECTOR` | Comprueba el control de acceso por rol. |
| `POST /api/v1/example-user` | JWT válido | Registra un usuario auxiliar de ejemplo; responde `201` o `409`. |

La cadena de seguridad es stateless, deshabilita CSRF y requiere bearer JWT para toda ruta que no esté declarada pública. OpenAPI/Swagger también está permitido en la cadena; su disponibilidad se controla con `AUTH_API_DOCS_ENABLED` y su valor cambia por perfil. CORS permite explícitamente `GET`, `PUT` y `OPTIONS`, los encabezados `Authorization` y `Content-Type`, y no permite credenciales de navegador. Por ello, `POST /example-user` no está incluido en los métodos CORS actuales.

`JwtConverter` agrega autoridades derivadas de scopes y roles del claim `resource_access[KEYCLOAK_RESOURCE_ID].roles`; convierte los roles a `ROLE_<nombre>`. El principal se obtiene del claim configurado, con fallback a `preferred_username` y luego `sub`. Para consultar el perfil, sin embargo, el controlador usa directamente el `sub` como UUID de Keycloak.

## Flujo A: consulta del perfil

1. El cliente llama a `GET /api/v1/auth/me` con un bearer token.
2. Spring Security valida el token y crea el contexto de autenticación con `JwtConverter`.
3. `UserProfileController` interpreta el `sub` como UUID y llama a `GetAuthUserProfileUseCase`.
4. `GetAuthUserProfileService` busca el usuario local por `keycloak_id`. Si no existe, lanza `UserNotFoundException`.
5. Consulta todos los registros asociados en `user_academic_contexts` y devuelve id local, username, correo, nombres, estado y contextos.

El endpoint no consulta Keycloak si el perfil local falta, no devuelve los roles y tampoco convierte los identificadores de facultad/programa a sus nombres. `isActive` se devuelve como dato, pero esta lectura no rechaza por sí misma a un usuario local inactivo; la autenticación depende de la validez del JWT.

## Flujo B: eventos de usuario y roles desde Keycloak

### Emisión

El módulo `keycloak-webhook` implementa un `EventListenerProvider` con id `uatf-webhook`. El listener examina eventos administrativos cuyo recurso sea `USER`:

- `CREATE` y `UPDATE` generan snapshots de perfil.
- `CREATE` y `DELETE` bajo rutas de `role-mappings` generan `USER_ROLES_UPDATED`.
- El callback de eventos de usuario final (`onEvent(Event)`) está vacío; el comportamiento observado depende de Admin Events.
- No se maneja el borrado del usuario como evento de sincronización.

Para cada evento manejado, el provider obtiene al usuario de Keycloak y construye un JSON con `eventId` UUID, realm, tipo, timestamp, perfil habilitado y snapshot de roles. Publica el mensaje persistente en la cola `keycloak.user.events`, usando el exchange default; el `messageId` coincide con `eventId`. El publisher espera confirmación del broker, usa entrega obligatoria y realiza hasta tres intentos de publicación.

### Consumo y persistencia

1. `KeycloakUserEventConsumer` recibe el JSON en `keycloak.user.events`; valida presencia de `eventId` y del UUID del usuario.
2. En una transacción, `KeycloakEventInboxAdapter` inserta el identificador en `processed_keycloak_events`. Una clave primaria evita procesar dos veces el mismo `eventId`.
3. Si el evento es nuevo, el consumer forma `SyncUserCommand` y llama a `SyncUserService`; si ya se procesó, retorna sin cambios.
4. `SyncUserService` crea o actualiza el usuario por `keycloak_id`, usando las reglas de validación del dominio.
5. Si el mensaje incluye snapshot de roles, el servicio descarta roles de cliente y conserva únicamente roles de realm que coinciden con `SUPERADMIN`, `RECTOR`, `DECANO` o `DIRECTOR`. Reemplaza la relación local de roles por ese conjunto. Si el snapshot de roles no viene, conserva la réplica previa.
6. El inbox, el perfil y la actualización de roles se guardan con la transacción local. El listener AMQP trabaja con concurrencia máxima uno y prefetch uno; los fallos tienen hasta tres intentos y, agotados estos, no se reencolan y pasan a `keycloak.user.events.dlq`.

La deduplicación más entrega persistente proporciona procesamiento repetible para un mismo `eventId`; no es una transacción distribuida ni una garantía *exactly-once*. La DLQ es durable y requiere operación de inspección/reproceso que no forma parte del servicio analizado.

El diagrama de extremo a extremo, con reintentos y límites de recuperación, está centralizado en [Diagramas de secuencia — auth-service](../../docs/sequence-diagrams/auth-service.md#flujo-implementado--eventos-keycloak-rabbitmq-y-persistencia-iam).

### Límite de fiabilidad observado

El listener de Keycloak captura las excepciones del publisher y solo las escribe en el log. Si no logra publicar después de los reintentos, la operación administrativa de Keycloak no se revierte y no se observa un outbox ni un proceso de reconciliación que recupere automáticamente ese evento perdido. Por tanto, la fila local puede quedar temporalmente o permanentemente desactualizada hasta que otro evento la actualice o se ejecute una recuperación externa.

## Flujo C: asignación del contexto académico

`AcademicContextAssignmentController` expone `PUT /api/v1/admin/users/{userId}/academic-contexts`. `userId` es el UUID local; el actor se identifica a partir del `sub` del JWT. `@PreAuthorize` exige `ROLE_SUPERADMIN` directamente desde las autoridades del token.

El body contiene el conjunto completo a guardar:

```json
{
  "contexts": [
    { "facultyId": 12, "careerId": "025" }
  ]
}
```

El caso de uso ejecuta, en este orden, las verificaciones relevantes:

1. Confirma que el usuario objetivo exista.
2. Lee sus roles locales reconocidos, sincronizados desde Keycloak, y selecciona el de mayor precedencia: `SUPERADMIN`, `RECTOR`, `DECANO`, `DIRECTOR`.
3. Exige cero contextos para `SUPERADMIN`/`RECTOR` y exactamente uno para `DECANO`/`DIRECTOR`.
4. Valida la forma del contexto: rector y superadmin sin facultad/programa; decano con facultad y sin programa; director con facultad y programa.
5. Comprueba que facultad y programa existan y estén activos en los catálogos locales; el programa debe pertenecer a la facultad indicada.
6. Reemplaza el conjunto previo dentro de una transacción y registra `USER_ACADEMIC_CONTEXTS_REPLACED` con actor, objetivo, rol y cantidad de contextos.

Un `contexts: []` elimina los contextos previos y solo es válido para rector o superadmin. Si falta el snapshot local de roles reconocido, la operación falla con conflicto (`409`); la autenticación del actor no se basa en esa réplica, sino en el JWT.

El diagrama de validación y reemplazo transaccional está centralizado en [Diagramas de secuencia — auth-service](../../docs/sequence-diagrams/auth-service.md#flujo-implementado--asignacion-de-contexto-academico).

### Catálogo académico

`V3__create_academic_catalog.sql` crea `academic_faculties` y `academic_programs`, con estado activo y fecha de sincronización. La API consulta esas tablas mediante JDBC. El código de `auth-service` no extrae el catálogo de Jachasun: los artefactos revisados de Apache Hop definen un workflow separado que sincroniza primero facultades y luego programas mediante upserts. El script de provisión limita al usuario de Hop a `SELECT`/`INSERT`/`UPDATE` sobre esas tablas, sin `DELETE` ni DDL. Este flujo externo no fue ejecutado en esta revisión.

La secuencia de sincronización del catálogo está centralizada en [Diagramas de secuencia — auth-service](../../docs/sequence-diagrams/auth-service.md#flujo-integrado--sincronizacion-del-catalogo-por-apache-hop). El [README de Apache Hop](../../etl-layer/apache-hop/README.md) describe la configuración y operación del workflow.

## Persistencia local

Las migraciones observadas definen:

- `users`: UUID local, `keycloak_id` único, username/email únicos, perfil, estado y marcas de tiempo.
- `roles` y `user_roles`: catálogo de roles reconocidos y relación de usuarios.
- `user_academic_contexts`: asignaciones de facultad/programa, con reglas y referencias a catálogos.
- `academic_faculties` y `academic_programs`: catálogo académico local, consumido por la API de asignación.
- `processed_keycloak_events`: inbox de idempotencia, con `event_id` como clave primaria y timestamp de procesamiento.
- `example_users`: tabla auxiliar de registro demostrativo.
- `revinfo` y `revchanges`: tablas preexistentes en la migración inicial.

V2 transforma `career_id` a `CHAR(3)` con ceros a la izquierda. V4 siembra los cuatro roles de aplicación. V5 crea la tabla inbox de eventos. Las tablas `revinfo`/`revchanges` no bastan para afirmar que el historial se registre: el `pom.xml` revisado no declara Hibernate Envers ni se encontraron entidades anotadas con `@Audited`.

## Rutas auxiliares y límites funcionales

- `DemoEndpoint` contiene rutas para probar acceso por rol; no implementa acciones DSS ni dashboards.
- `ExampleUserController` y `RegisterExampleUserService` verifican correo duplicado y persisten un registro en `example_users`; son funcionalidad demostrativa.
- Los roles locales sirven como snapshot consultado para reglas del contexto académico. La seguridad HTTP usa los roles presentes en el JWT.
- No hay un endpoint en `auth-service` para conceder o revocar roles en Keycloak; el servicio recibe y replica snapshots de roles, pero la administración de esos roles ocurre en Keycloak.
- El servicio no implementa autorización por facultad/programa sobre endpoints de analítica, no configura RLS y no propaga aquí un contexto de sesión al Data Warehouse.
- `GET /auth/me` expone los contextos para que un cliente autorizado los consuma; la aplicación de ese alcance fuera de este servicio corresponde a otra capa.

## Errores, auditoría y operación

- `GlobalExceptionHandler` transforma `UserNotFoundException` en `404 USER_NOT_SYNCED` y las excepciones de dominio en el código HTTP definido por cada excepción. Spring Security responde `401/403` para autenticación/autorización.
- `AUDIT_LOGGER` produce eventos estructurados. La sincronización registra `USER_SYNCED`; la sustitución de contexto registra actor y objetivo.
- `AuditLoggingListener` observa eventos de autenticación asociados con `/auth/me`, roles e IP. La ruta servlet normalmente incluye el context path `/api/v1`, mientras que el listener compara el path completo con `/auth/me`; esa comparación parece no coincidir con el URI real y debe confirmarse en ejecución.
- Cuando la conexión llega desde una dirección privada o loopback, la auditoría puede tomar IP de `X-Real-IP`, `Forwarded` o `X-Forwarded-For`. Estas cabeceras solo son fiables si el servicio está detrás de proxies confiables que las limpian y establecen.
- Actuator expone `health`, `info` y `metrics`; el detalle de salud se limita a usuarios autorizados.

## Cambios frente a la revisión anterior

1. Se eliminaron `UserSyncController`, `UserSyncRequest` y `WebhookSecretFilter`; ya no existe el endpoint HTTP `POST /auth/sync` ni el secreto `X-Webhook-Secret` para sincronizar Keycloak.
2. Se incorporaron el consumidor RabbitMQ, publisher de Keycloak, cola durable, DLQ, confirmaciones de publicación, reintentos e inbox de eventos deduplicados.
3. Los eventos sincronizan snapshots de rol además del perfil; se agregaron roles iniciales mediante Flyway V4.
4. Se implementó `PUT /admin/users/{userId}/academic-contexts`, la validación de su contexto según rol, y comprobaciones contra facultades/programas activos.
5. Apache Hop ahora cuenta con artefactos de sincronización del catálogo local usados por la API de contextos; `auth-service` solo consulta ese catálogo.

## Evidencia revisada

El diagrama C4 de componentes actualizado está en [auth-service-componentes.mmd](auth-service-componentes.mmd). Muestra el flujo de consulta y administración, además de la sincronización asíncrona desde Keycloak.

| Área | Archivos principales |
|---|---|
| Build y ejecución | `auth-service/pom.xml`, `auth-service/Dockerfile`, `auth-service/src/main/java/uatf/dss/authservice/AuthServiceApplication.java` |
| API, seguridad y configuración | `adapter/in/web/*Controller.java`, `SecurityConfig.java`, `JwtConverter.java`, `application*.yaml`, `OpenApiConfig.java` |
| Eventos | `adapter/in/messaging/KeycloakUserEventConsumer.java`, `RabbitMessagingConfiguration.java`, módulo `keycloak-webhook/src/main/java/uatf/keycloak/*` |
| Casos de uso | `GetAuthUserProfileService.java`, `SyncUserService.java`, `SetUserAcademicContextsService.java`, `RegisterExampleUserService.java` |
| Dominio | `User.java`, `UserAcademicContext.java`, `RoleType.java`, `AcademicContextValidator.java`, excepciones de dominio |
| Persistencia | `adapter/out/persistence/*`, `V1__init_schema.sql`–`V5__create_keycloak_event_inbox.sql` |
| Catálogo académico | `V3__create_academic_catalog.sql`, `auth-service/ops/database/provision-hop-academic-catalog.sql`, workflow y pipelines `etl-layer/apache-hop/projects/dss-uatf-etl` |
| Auditoría y contratos | `configuration/audit/*`, `logback-spring.xml`, `docs/keycloak/keycloak_specification.md` |

## Aspectos no verificados

- No se ejecutó la suite de pruebas ni el flujo integrado con RabbitMQ, Keycloak, PostgreSQL y Apache Hop.
- No se inspeccionaron secretos ni contenido de archivos `.env`.
- No se comprobó en un entorno activo el destino de mensajes rechazados, el reproceso de DLQ, la disponibilidad del catálogo ni la ruta exacta que observa el auditor HTTP.
- El código no demuestra alta disponibilidad de RabbitMQ ni un mecanismo para reparar automáticamente eventos de Keycloak que el publisher no alcance a publicar.
