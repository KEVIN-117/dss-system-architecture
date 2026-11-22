# Load Manager en dw-control-service

Estado: LM-003 (#351) implementó la ejecución y el monitoreo, y LM-004 (#352) las programaciones. La API REST (LM-005) se apoya en estos servicios. Referencias: [contrato de Hop Server](hop-server-contract.md) y [esquema `etl_control`](load-manager-schema.md).

## Piezas

| Capa | Clase | Responsabilidad |
|---|---|---|
| Puerto de salida | `HopExecutionPort` | Enviar, consultar, detener y retirar ejecuciones. El dominio no conoce HTTP. |
| Adaptador | `HopServerClient`, `HopLauncherWorkflow`, `HopResponses` | `RestClient` con Basic Auth y timeouts. Construye el XML del lanzador y parsea XML con DTD y entidades externas desactivadas. Decodifica el log (gzip + base64). |
| Persistencia | `JdbcEtlProcessCatalogRepository`, `JdbcEtlLaunchRepository` | `SELECT` sobre las tablas y escritura **solo** mediante las funciones de la migración `0065`. Los SQLSTATE `23505` y `23514` se traducen en `EtlLaunchConflictException`. |
| Aplicación | `LaunchEtlService` | Valida el proceso y arma sus parámetros. Registra el lanzamiento (`QUEUED`), lo envía a Hop y lo marca `SUBMITTED`. |
| Aplicación | `StopEtlLaunchService` | Audita el pedido de detención. Llama a `stopWorkflow`, o detiene en el acto un lanzamiento que nunca llegó a Hop. |
| Aplicación | `EtlMonitoringService` + `EtlLaunchMonitorJob` | Cada `interval-ms` sincroniza los lanzamientos activos con Hop. El portal solo lee PostgreSQL. |
| Configuración | `EtlProperties` (`app.etl.*`), `LoadManagerConfiguration`, `SchedulingConfiguration` | Variables en `docs/envs/dw-control-service.md`. |

## Parámetros por proceso

| Proceso | Entrada | Parámetros enviados a Hop |
|---|---|---|
| `VERTICAL_LOAD` + `CIERRE_ACADEMICO` | `closureId` de un cierre `CERRADO` | `P_RUN_ID` (nuevo), `P_REQUESTED_GESTION`, `P_REQUESTED_PERIODO`, `P_EXECUTION_KIND` |
| `VERTICAL_LOAD` + `REPROCESO` | `retryOfRunId` | Los anteriores; la gestión y el periodo salen de la ejecución original. Se añade `P_RETRY_OF_RUN_ID`. |
| `PUBLISH_STAGED` | `runId` de una ejecución existente | `P_RUN_ID` |
| `CATALOG_SYNC` | — | — |

`HISTORICA` no se lanza desde el Load Manager. El servicio comprueba además que los parámetros que arma estén en `etl_process.parameter_names`. La función `request_etl_launch` vuelve a validarlos en la base.

## Envío

1. `request_etl_launch` crea la fila `QUEUED` y se confirma antes de llamar a Hop. Así, un fallo de Hop queda registrado. Un segundo lanzamiento del mismo proceso devuelve `409`.
2. `registerWorkflow` + `startWorkflow` → `SUBMITTED` con `hop_execution_id`.
3. Si algo falla:
   - Hop no responde: el lanzamiento queda `SUBMIT_FAILED` y la API devuelve `503`.
   - Hop rechaza la solicitud: queda `SUBMIT_FAILED` con el motivo y se devuelve el lanzamiento.
   - Falla el registro de `SUBMITTED`: se registra un log de error con el id de Hop. El monitor marcará luego el lanzamiento como `SUBMIT_FAILED` cuando venza `queued-grace`.

## Monitor

| Estado en Hop | Lanzamiento |
|---|---|
| `Waiting` / `Initializing` | Sin cambios |
| `Running` (también `Paused`, `Stopping`, `Halting`) | `SUBMITTED → RUNNING`. Si ya estaba en `RUNNING`, solo refresca el extracto de log y no genera evento. |
| `Finished` sin errores | `SUCCEEDED`; luego se llama a `removeWorkflow` |
| `Finished (with errors)` / `Halted` | `FAILED`, con la última línea `ERROR` del log como resumen (`componente: mensaje`) |
| `Stopped` | `STOPPED` (“Detenido a pedido de …”) |
| Desconocido para Hop | `FAILED` cuando vence `not-found-grace` (2 min), porque Hop se reinició o purgó la ejecución |

Además:

- Un lanzamiento `QUEUED` sin id de Hop pasa a `SUBMIT_FAILED` cuando vence `queued-grace` (5 min).
- Mientras la detención no se refleje en Hop, el monitor vuelve a enviarla.
- Si Hop no está disponible, el monitor corta la ronda y reintenta en la siguiente.
- Varias instancias pueden monitorear a la vez sin problema: la base valida cada transición y una actualización concurrente simplemente se omite.

**Logs.** Antes de guardarse, `EtlLogExcerpts` les quita los caracteres de control y enmascara credenciales (`password=`, `token:`, `usuario:clave@` en URLs). Se conserva solo la cola, de hasta 64 KiB.

## Programaciones (LM-004)

Este es el alcance del Load Manager: programar las actualizaciones del DW para que corran fuera del horario operativo de la DSA y registrar la fecha y el resultado de cada ejecución.

| Pieza | Responsabilidad |
|---|---|
| `OperatingWindowPolicy` | Horario operativo de la DSA (`app.etl.operating-window`, por defecto lunes a viernes de 08:00 a 18:00 en `America/La_Paz`). Valida la expresión cron de Spring de 6 campos y la zona IANA, y calcula las próximas ocurrencias. |
| `ScheduleService` | Altas, cambios, pausa y reactivación, borrado lógico y vista previa. Calcula `next_fire_at`, porque la base de datos no evalúa cron. |
| `ScheduledFireService` + `EtlScheduleFireJob` | Cada 30 s reclama las programaciones vencidas (`claim_due_etl_schedules`) y las dispara. |
| `JdbcEtlScheduleRepository` | Opera solo a través de las funciones de `0065`. Traduce `22023` a 400, `P0002` a 404 y `23505`, `40001` y `55006` a 409. |

**Reglas de validación.** Se aplican al crear, al editar y al reactivar, porque el horario puede haber cambiado desde que se creó la programación.

- La programación tiene que producir ejecuciones futuras.
- Ninguna de las próximas 20 ocurrencias puede caer dentro del horario operativo. La ocurrencia se calcula en la zona de la programación y se compara en la zona del horario.
- Entre dos ocurrencias seguidas debe haber al menos `min-interval` (1 h).
- Solo se pueden programar los procesos que tienen `schedule_mode`: `VERTICAL_LOAD` y `CATALOG_SYNC`. `PUBLISH_STAGED` queda como proceso manual.
- El proceso de una programación no se puede cambiar.

**Qué pasa en cada disparo.** Cada disparo termina en exactamente un lanzamiento, así que siempre quedan su fecha y su resultado:

1. Si la hora real cae dentro del horario operativo, el disparo se registra como `SKIPPED` y no se ejecuta nada. Es un segundo control, por si el horario cambió después de validar.
2. Con `AUTO_PENDING_CLOSURES` se toma el cierre `CERRADO` más antiguo y se lanza `CIERRE_ACADEMICO` como `SCHEDULED`. Si no hay ninguno, el disparo se registra como `SKIPPED` con el motivo «No hay cierres académicos CERRADO pendientes de procesar». Se procesa un solo cierre por disparo; los demás quedan para los disparos siguientes.
3. Con `NO_PARAMETERS` se lanza el proceso tal cual.
4. Si el proceso ya tiene un lanzamiento activo, el disparo queda `SKIPPED` («Ya hay una ejecución activa del proceso …»). Si Hop no está disponible, el lanzamiento programado queda `SUBMIT_FAILED`; no se lanza ninguna excepción, para que el disparo igual se cierre.
5. `complete_etl_schedule_fire` registra el evento `FIRED` o `SKIPPED` y fija el siguiente `next_fire_at`.

El siguiente disparo se calcula desde el momento actual, así que las ocurrencias perdidas mientras el servicio estuvo caído no se recuperan. Varias réplicas pueden disparar sin duplicar ejecuciones: `FOR UPDATE SKIP LOCKED` más el lease de cada disparo lo impiden (probado en `etl_schedule_claim_concurrency_test.sh`). Si una instancia cae a mitad de un disparo, el lease vence y otra lo retoma.

## Errores HTTP

| Excepción | HTTP |
|---|---|
| `EtlProcessNotFoundException`, `EtlLaunchNotFoundException`, cierre o ejecución inexistente | 404 |
| `InvalidEtlLaunchRequestException` | 400 (con el motivo) |
| `EtlLaunchConflictException` | 409 |
| `HopUnavailableException` | 503 (`HOP_UNAVAILABLE`) |
| `HopRequestRejectedException` | 502 (`HOP_REJECTED`) |
| `InvalidEtlScheduleException` | 400, con el motivo (horario DSA, cron, zona o frecuencia) |
| `EtlScheduleNotFoundException` | 404 |
| `EtlScheduleConflictException` | 409 (nombre duplicado, `row_version` obsoleto o programación en pleno disparo) |

## Pruebas

- **Unitarias** (`./gradlew test`): `HopServerClientTest` (con `MockRestServiceServer`, incluye XXE y la respuesta *not found* en HTML), `LaunchEtlServiceTest`, `StopEtlLaunchServiceTest`, `EtlMonitoringServiceTest` y `EtlLogExcerptsTest`, más `OperatingWindowPolicyTest`, `ScheduleServiceTest` y `ScheduledFireServiceTest` (LM-004).
- **Integración** (`LoadManagerHopIntegrationTest`): se omite si no hay entorno. Usa un DW real con las migraciones y el Hop Server de LM-001, con un login que solo hereda `dw_control_service`:

```bash
export DW_INTEGRATION_SOURCE_PORT=55432 DW_INTEGRATION_TARGET_PORT=55433
C="docker compose -p lm003it -f infra/dw-integration/dw-integration-test.yml --profile hop-server"
$C up -d --build --wait jachasun-fixture auth-catalog-fixture postgres-dw hop-server
$C run --rm --no-deps migration-only
docker run --rm --network lm003it_default postgres:15-alpine \
  psql "postgresql://dw_test:dw_test@postgres-dw:5432/dw_integration" \
  -c "CREATE ROLE lm_it LOGIN PASSWORD 'lm_it_password'; GRANT dw_control_service TO lm_it;"
cd dw-control-service
LM_IT_DB_URL=jdbc:postgresql://127.0.0.1:55433/dw_integration LM_IT_DB_USER=lm_it LM_IT_DB_PASSWORD=lm_it_password \
LM_IT_ADMIN_DB_USER=dw_test LM_IT_ADMIN_DB_PASSWORD=dw_test \
LM_IT_HOP_URL=http://127.0.0.1:58080 LM_IT_HOP_USER=hop-integration LM_IT_HOP_PASSWORD=hop-integration-test-only \
  ./gradlew test --tests chronos.dw.admin.LoadManagerHopIntegrationTest
$C down -v
```

El test lanza `CATALOG_SYNC` y comprueba que un segundo lanzamiento da `409`. Después sigue el lanzamiento hasta `SUCCEEDED` y verifica el extracto de log y los eventos de auditoría.

El segundo test (LM-004) crea con el login del servicio una programación de `CATALOG_SYNC` y otra de `VERTICAL_LOAD`, y verifica que se rechace una a las 10:00. Luego las adelanta con el login administrador y las dispara con un reloj nocturno. Comprueba que el catálogo se lanza como `SCHEDULED` y termina `SUCCEEDED`, que la carga vertical queda `SKIPPED` porque no hay cierres pendientes, y que se registran los eventos `FIRED`/`SKIPPED` y el siguiente disparo.
