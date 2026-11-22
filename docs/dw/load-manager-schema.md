# Esquema del Load Manager (`etl_control`)

Estado: implementado en LM-002 (#350), migraciones `0062`–`0065`. dw-control-service lo usa a partir de LM-003/LM-004. El contrato con Hop Server está en [hop-server-contract.md](hop-server-contract.md).

## Responsabilidades

| Pieza | Responsable |
|---|---|
| Qué workflows se pueden lanzar y con qué parámetros | `etl_process` (catálogo semilla, coincide con `EXECUTABLE_WORKFLOWS` de `validate_project.py`) |
| Quién pidió cada ejecución, cuándo, cómo terminó en Hop | `etl_launch` + `etl_launch_event` |
| Resultado de negocio de una carga del DW | `etl_execution` (sin cambios; lo escribe el workflow con `P_RUN_ID`) |
| Programaciones y su historial de disparos | `etl_schedule` + `etl_schedule_event` |
| Expresión cron, horario operativo DSA y cálculo de `next_fire_at` | dw-control-service (Spring `CronExpression`); la base solo almacena y valida forma |

## Tablas

- **`etl_process`**: `process_code` (`VERTICAL_LOAD`, `CATALOG_SYNC`, `PUBLISH_STAGED`), `workflow_file` relativo al `PROJECT_HOME`, `parameter_names` exactos, `schedule_mode` (`AUTO_PENDING_CLOSURES`, `NO_PARAMETERS` o `NULL` = solo manual), `enabled`.
- **`etl_launch`**:
  - origen: `trigger_kind` `MANUAL` o `SCHEDULED`; este último exige `schedule_id`;
  - vínculos: `closure_id` y `run_id` (= `P_RUN_ID`, sin FK porque `etl_execution` se crea cuando arranca el workflow);
  - `parameters` (objeto de cadenas) y `hop_execution_id`;
  - fechas: `requested_at`, `submitted_at`, `started_at`, `finished_at`;
  - detención: `stop_requested_by`, `stop_requested_at`;
  - resultado: `result_summary` (≤ 2000) y `log_excerpt` (≤ 64 KiB).

  Un índice único parcial permite **un solo lanzamiento activo por proceso** (`QUEUED`, `SUBMITTED`, `RUNNING`).
- **`etl_launch_event`**: auditoría append-only. Eventos: `REQUESTED`, `STATUS_CHANGED`, `STOP_REQUESTED`, `SKIPPED`.
- **`etl_schedule`**:
  - definición: nombre único entre las no eliminadas (sin distinguir mayúsculas), `cron_expression` de 6 campos, `timezone` validada contra `pg_timezone_names` y `mode` copiado del proceso;
  - disparos: `enabled`, `next_fire_at`, `last_fired_at`, `last_launch_id`;
  - control: lease `claim_token`/`claimed_until`, `row_version` y borrado lógico `deleted_at`.
- **`etl_schedule_event`**: `CREATED`, `UPDATED`, `ENABLED`, `DISABLED`, `DELETED`, `FIRED`, `SKIPPED`. Los disparos referencian su lanzamiento.

## Ciclo de vida de un lanzamiento

```text
QUEUED ──► SUBMITTED ──► RUNNING ──► SUCCEEDED | FAILED | STOPPED
  │            └──────────────────► SUCCEEDED | FAILED | STOPPED
  └──► SUBMIT_FAILED | SKIPPED | STOPPED
```

- `SUBMITTED` exige el `hop_execution_id` devuelto por `registerWorkflow`.
- Repetir el estado actual (no terminal) solo refresca `result_summary` y `log_excerpt`, sin crear un evento. Así el monitor puede sondear sin inflar la auditoría.
- Un disparo programado sin trabajo se registra directamente como `SKIPPED` (OMITIDA) con motivo y fecha, mediante `record_skipped_etl_launch`. Pasa, por ejemplo, cuando no hay cierres `CERRADO` sin procesar o ya hay una carga activa.

## Disparo de programaciones (varias instancias)

1. `claim_due_etl_schedules(limit, lease_seconds)` devuelve las programaciones vencidas y les asigna un `claim_token` con lease. Usa `FOR UPDATE SKIP LOCKED`, así que dos instancias nunca reciben la misma programación. Mientras el lease está vigente, tampoco se vuelve a entregar.
2. El servicio crea el lanzamiento con `request_etl_launch(..., p_schedule_id)` o el omitido con `record_skipped_etl_launch`.
3. `complete_etl_schedule_fire(schedule_id, claim_token, launch_id, next_fire_at, actor)` valida el token y registra `FIRED`/`SKIPPED`. Después avanza `next_fire_at` y libera el lease.

Si la instancia muere, el lease vence y otra instancia reclama la programación. Mientras está reclamada, editar, pausar o borrar devuelve `55006`.

## Funciones (solo `dw_control_api`, heredado por `dw_control_service`)

| Función | Uso |
|---|---|
| `request_etl_launch(launch_id, process_code, requested_by, parameters, closure_id, run_id, schedule_id)` | Solicitud `QUEUED` |
| `transition_etl_launch(launch_id, to_status, actor, hop_execution_id, result_summary, log_excerpt)` | Avance del ciclo de vida |
| `request_etl_launch_stop(launch_id, actor)` | Marca la detención solicitada (idempotente) |
| `record_skipped_etl_launch(launch_id, schedule_id, actor, reason)` | Disparo omitido |
| `create_etl_schedule`, `update_etl_schedule`, `set_etl_schedule_enabled`, `delete_etl_schedule` | Administración con `row_version` |
| `claim_due_etl_schedules`, `complete_etl_schedule_fire` | Disparo concurrente seguro |

`dw_control_reader` tiene `SELECT` en las cinco tablas. Ningún rol del servicio tiene DML directo, y ni `dw_control_reader` ni `dw_hop_runtime` pueden ejecutar los comandos. La migración `0065` lo verifica al aplicarse.

## Códigos de error

| SQLSTATE | Caso | HTTP sugerido |
|---|---|---|
| `22023` | Parámetro, actor, cron, zona horaria o proceso no programable inválidos | 400 |
| `P0002` | Proceso, lanzamiento, cierre o programación inexistente | 404 |
| `23505` | Ya hay un lanzamiento activo del proceso, o el nombre de la programación está duplicado | 409 |
| `23514` | Transición de lanzamiento no permitida | 409 |
| `40001` | `row_version` obsoleto | 409 |
| `55006` | Programación en disparo, o token de disparo ajeno | 409 |

## Pruebas

- `infra/dw-schema/tests/etl_load_manager_test.sql`: catálogo, privilegios, ciclo de vida, validaciones, programaciones, omisión e historial.
- `infra/dw-schema/tests/etl_schedule_claim_concurrency_test.sh`: dos instancias reclaman a la vez y solo una obtiene la programación.

Ambas corren en `infra/dw-schema/dw-test-docker.yml`, igual que en CI y en el hook pre-push.
