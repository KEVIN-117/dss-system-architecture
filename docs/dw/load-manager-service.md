# Load Manager en dw-control-service

Estado: LM-003 (#351) implementó la ejecución y el monitoreo. Las programaciones (LM-004) y la API REST (LM-005) se apoyan en estos servicios. Referencias: [contrato de Hop Server](hop-server-contract.md) y [esquema `etl_control`](load-manager-schema.md).

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

## Errores HTTP

| Excepción | HTTP |
|---|---|
| `EtlProcessNotFoundException`, `EtlLaunchNotFoundException`, cierre o ejecución inexistente | 404 |
| `InvalidEtlLaunchRequestException` | 400 (con el motivo) |
| `EtlLaunchConflictException` | 409 |
| `HopUnavailableException` | 503 (`HOP_UNAVAILABLE`) |
| `HopRequestRejectedException` | 502 (`HOP_REJECTED`) |

## Pruebas

- **Unitarias** (`./gradlew test`): `HopServerClientTest` (con `MockRestServiceServer`, incluye XXE y la respuesta *not found* en HTML), `LaunchEtlServiceTest`, `StopEtlLaunchServiceTest`, `EtlMonitoringServiceTest` y `EtlLogExcerptsTest`.
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
LM_IT_HOP_URL=http://127.0.0.1:58080 LM_IT_HOP_USER=hop-integration LM_IT_HOP_PASSWORD=hop-integration-test-only \
  ./gradlew test --tests chronos.dw.admin.LoadManagerHopIntegrationTest
$C down -v
```

El test lanza `CATALOG_SYNC` y comprueba que un segundo lanzamiento da `409`. Después sigue el lanzamiento hasta `SUCCEEDED` y verifica el extracto de log y los eventos de auditoría.
