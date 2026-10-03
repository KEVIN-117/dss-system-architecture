# DW-012 — Artefactos RAW y verificación previa a Hop

## Formato y ubicación

Load Manager escribe el snapshot de los nueve contratos DW-001 como JSON Lines UTF-8, comprimido con gzip. Cada línea es un objeto cuyas propiedades conservan los nombres declarados por el contrato; los nulos SQL se representan como `null`, las columnas numéricas permanecen numéricas y las fechas/timestamps usan la serialización JSON estándar de Go. Los archivos no se incorporan a Git.

```text
${DW_RAW_ROOT}/
  source=<schema.object>/
    run_id=<uuid>/
      part-000001.jsonl.gz
      part-000002.jsonl.gz
```

Cada intento usa un `run_id` nuevo y rutas inmutables. Los ficheros temporales se crean junto a la parte final, se comprimen y sincronizan antes de renombrarse atómicamente. Load Manager monta el volumen con escritura; Hop debe montarlo en solo lectura. La retención y eliminación automática no forman parte de DW-012: TI define retención y borrado controlado antes de habilitar producción.

## Manifiestos, checkpoints y elegibilidad

Por fuente, `etl_source_manifest` registra contrato/versión, hash SHA-256 de la consulta y del esquema, periodo solicitado, orden estable, conteo y estado. Cada parte se registra en `etl_source_manifest_artifact` con URI `file:`, SHA-256 de los bytes gzip, bytes y filas. El checkpoint del paso de extracción conserva el último lote y la relación de partes. `source_complete` solo se persiste después de terminar las nueve consultas bajo la misma transacción OLTP de solo lectura `REPEATABLE READ`.

`etl_execution_step.step_code = 'verify_raw_bundle'` es el gate. Solo queda exitoso tras comprobar que existen los nueve manifiestos completos y que cada parte coincide en ruta, tamaño, hash, gzip, JSONL y conteo. La migración `0008` crea `dw_raw_verifier`, limitado a `CONNECT`/`USAGE` y `SELECT` sobre las cuatro tablas de evidencia. TI crea su usuario `LOGIN` y lo agrega a ese rol; no se reutiliza la credencial escritora.

El workflow `etl-layer/apache-hop/project-uatf/workflows/main_orchestrator.hwf` exige el parámetro `RUN_ID` y ejecuta el preflight con `/usr/local/bin/raw-verify` antes de iniciar el pipeline lector. Hop monta el volumen RAW en solo lectura; su imagen personalizada incluye únicamente el binario verificador, y el script usa `DB_DW_VERIFY_USER`/`DB_DW_VERIFY_PASS`, nunca la cuenta escritora.

`pipelines/pl_read_raw_bundle.hpl` abre los nueve directorios de contrato del `RUN_ID`, descomprime las partes GZip y lee cada línea JSONL como `json_record`. Las filas se descartan sin registrarlas ni publicarlas. Esta es la integración de ingestión RAW y una comprobación de que Hop puede leer el formato; **no** es todavía la transformación de propiedades JSON a campos dimensionales ni una carga a `dw.*`.

Los workflows `wf_carga_dimensiones.hwf` y `wf_carga_hechos.hwf` y sus pipelines anteriores son legado/prototipos: consultan OLTP y apuntan a tablas `public.*`. No deben ejecutarse como parte de la ruta DW-012. La transformación tipada de RAW y su publicación al modelo dimensional requieren su siguiente fase, tras definir las tablas destino y reglas de mapeo.

Configuración: construir/actualizar la imagen personalizada de Hop, configurar en el entorno de Compose `DB_DW_VERIFY_USER` y `DB_DW_VERIFY_PASS` para un login miembro de `dw_raw_verifier`, y conservar `DW_RAW_ROOT=/dw-raw`. Las credenciales no se versionan. El usuario de verificación requiere solamente los permisos `SELECT` documentados por la migración `0008`.

Ejecución: abrir `workflows/main_orchestrator.hwf`, ingresar el `RUN_ID` completo y ejecutar. El workflow debe mostrar primero `RAW bundle eligible` y después completar `pl_read_raw_bundle`; ante error del verificador o del lector, el workflow aborta. También se puede lanzar por Hop Run usando el parámetro `RUN_ID` (`-p RUN_ID=<UUID>`), desde el proyecto y el entorno configurados. La prueba end-to-end reproducible con fixtures y UUID sintético está en [apache-hop/README.md](../../etl-layer/apache-hop/README.md).

El montaje de Hop es de solo lectura y las filas no se escriben en logs. El flujo legacy de dimensiones/hechos no se invoca.

El CLI de verificación también puede ejecutarse directamente antes de Hop:

```powershell
# Configure DB_DW_VERIFY_* secrets in the local, untracked .env first.
docker compose --profile dw-raw run --rm loadmanager-raw-verifier -run-id <UUID>
```

El comando `raw-verify` sale con error ante un gate ausente, un manifiesto incompleto, un archivo faltante o alterado, un tamaño/hash incorrecto, gzip/JSONL inválido o conteos discordantes. El paso inicial del workflow de Hop debe invocar esta verificación como precondición y detener el workflow si falla; las transformaciones leen los `file:` URI del manifiesto, nunca las tablas OLTP ni la tabla histórica `staging.raw_uatf_datos`.

## Extracción y recuperación

La extracción manual/automatizada se ejecuta con `raw-extract`, un `run_id` UUID nuevo por intento y el corte aprobado por DSA:

```powershell
docker compose --profile dw-raw run --rm --entrypoint /app/raw-extract loadmanager-raw-tools `
  -run-id <UUID-nuevo> -actor <identidad-operativa> -year 2025 -period 2
```

Una caída antes de guardar `source_complete` vuelve fallido el intento; cualquier repetición requiere otro `run_id` y produce una nueva ruta. Si el checkpoint de finalización ya está persistido, se puede repetir `raw-extract` con ese mismo `run_id` para finalizar manifiestos/gate sin consultar OLTP. No se reanudan páginas parciales. La tabla `staging.raw_uatf_datos` y sus filas históricas se preservan, pero DW-012 no escribe nuevas filas allí.

## Operación segura

- Mantener la cuenta OLTP con `CONNECT`, `USAGE` y `SELECT` únicamente sobre fuentes aprobadas.
- La cuenta destino de extracción requiere únicamente rutinas y lectura/escritura de control permitidas al rol `dw_staging_writer`; no requiere DML sobre `staging.raw_uatf_datos`.
- La cuenta de verificación pertenece solo a `dw_raw_verifier` para las tablas de evidencia y monta el volumen RAW en solo lectura.
- No registrar filas, identificadores personales, secretos ni contenido de archivos en logs.
- Medir la extracción contra Jachasun con DSA/TI antes de producción; los fixtures no sustituyen la validación real.
