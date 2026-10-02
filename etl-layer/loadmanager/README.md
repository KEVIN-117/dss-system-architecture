# Load Manager (Go)

Servicio Go responsable de coordinar la extracción OLTP hacia Staging. El primer vertical slice implementa la extracción full snapshot de `public.uatf_datos` al landing tipado `staging.raw_uatf_datos`, con manifiesto y auditoría DW-004. No expone todavía una operación HTTP para lanzar ejecuciones, ni configura cron.

## Prerrequisitos y verificación

Se usa la versión de Go declarada en `go.mod`.

```powershell
go mod tidy
go test ./...
go build ./cmd/loadmanager
go vet ./...
```

## Dependencias directas

- `github.com/google/uuid`: identificadores `run_id` de las ejecuciones.
- `github.com/jackc/pgx/v5`: driver y pools PostgreSQL.
- `gopkg.in/yaml.v3`: lectura estricta del archivo de configuración.

HTTP, logging (`log/slog`), contextos, JSON y pruebas utilizan la biblioteca estándar.

## Configuración

`configs/loadmanager.example.yaml` contiene timeouts y nombres de variables de entorno, no valores secretos. `config.Load` resuelve OLTP (`DB_TX_*`) y PostgreSQL DW (`DB_DW_*`). Staging y `etl_control` son esquemas de la misma base DW. Hay un pool DW separado para los advisory locks de coordinación; el pool de escritura conserva cuatro conexiones. `extraction.max_duration`, `source_statement_timeout`, `source_idle_timeout` y `target_write_timeout` acotan la extracción, las consultas OLTP y las transacciones del destino. La configuración exige un `sslmode` explícito y nunca imprime las credenciales.

La fuente de Jachasun utiliza `DB_TX_HOST`, `DB_TX_PORT`, `DB_TX_NAME`, `DB_TX_USER`, `DB_TX_PASS` y `DB_TX_SSLMODE`. El target utiliza las variables equivalentes `DB_DW_HOST`, `DB_DW_PORT`, `DB_DW_NAME`, `DB_DW_USER`, `DB_DW_PASS` y `DB_DW_SSLMODE`. El pool de origen fuerza transacciones de solo lectura y su cuenta OLTP debe limitarse a las fuentes aprobadas en DW-001. Los pools tienen un límite inicial de cuatro conexiones cada uno. `server.connect_timeout` se aplica a cada conexión física pgx; la creación del pool es perezosa y no valida la base por sí sola. La conexión real se valida al hacer `Ping` (incluido en readiness), acotado además por `server.readiness_timeout`; el servicio permanece vivo pero no-ready cuando una base no responde.

`GET /healthz` informa que el proceso HTTP está vivo. `GET /readyz` verifica OLTP y DW con el timeout configurado y devuelve solo `ready`/`not_ready`, sin revelar detalles de conexión. Los contextos de cada operación se propagan a pgx para poder cancelar adquisición/conexión/consulta en curso. El servidor puede iniciar aunque una dependencia esté temporalmente caída; readiness queda en 503 hasta que ambas respondan.

## Primer flujo de extracción

El extractor acepta solo la consulta DW-001 canónica (SHA-256 versionado) `infra/postgres-tx/extract/01_uatf_datos.sql`; una edición requiere una nueva versión aprobada. Recorre `public.uatf_datos` por keyset pagination, sin `OFFSET`. `SnapshotRequest.BatchSize` admite 1–10 000 filas (por defecto 1 000). Antes de leer, verifica tipos, longitudes, nulabilidad, colación y unicidad de `id_ra` en el catálogo OLTP. `id_ra`, `estado_civil` y `_modificado` son obligatorios en cada fila; los duplicados o nulos hacen fallar el snapshot. La colación PostgreSQL gobierna tanto `ORDER BY` como el cursor, sin comparación binaria adicional en Go. Cada lote confirma filas RAW, métricas y checkpoint v2 juntos.

**Recuperación:** una extracción parcial no se reanuda con el mismo `run_id`: se marca `FALLIDA` y el reproceso usa otro `run_id` enlazado. Una vez terminada la transacción OLTP, el checkpoint v2 persiste `source_complete` y el SHA-256 final; si se interrumpe solo el cierre del manifiesto, `RecoverInterruptedRun` repite la finalización desde DW sin consultar Jachasun. El manifiesto, artefacto, paso y métricas finales se confirman juntos. Un intento v1 completo sigue consultable; uno v1 parcial no se reanuda.

`staging.raw_uatf_datos` se crea en la migración aditiva DW-009 `0005`; no altera `0001`–`0004`. Las pruebas de integración ejecutan Go en Linux dentro del Compose contra fixtures sintéticos: validan Ping de OLTP/DW, que el principal OLTP efectivo solo tenga SELECT, que la sesión rechace escritura, que una consulta lenta se cancele y libere la conexión y que credenciales inválidas produzcan errores saneados. Algunos entornos Windows bloquean los binarios temporales generados por `go test`.

Para probar el vertical slice desde la raíz del repositorio:

```powershell
docker compose -f infra/dw-integration/dw-integration-test.yml up -d postgres-dw jachasun-fixture
docker compose -f infra/dw-integration/dw-integration-test.yml run --rm integration-test
docker compose -f infra/dw-integration/dw-integration-test.yml run --rm upgrade-test
docker compose -f infra/dw-integration/dw-integration-test.yml run --rm --no-deps loadmanager-integration-test
docker compose -f infra/dw-integration/dw-integration-test.yml down
```

Los pasos se ejecutan en orden sobre las mismas bases efímeras: `--abort-on-container-exit` no se usa porque detendría el test Go al finalizar el contenedor previo de migración/regresión.

## Arranque local contra fixtures

`scripts/run-local.ps1` carga `loadmanager/.env` sin ejecutarlo como código, inicia las bases sintéticas, ejecuta siempre el migrador idempotente y si falta el fixture lo siembra una vez. No depende de un número fijo de migraciones. El Compose publica la fuente en `127.0.0.1:5432` y el destino en `127.0.0.1:5433`. `.env.example` contiene credenciales públicas exclusivas de fixtures; no uses esos valores con Jachasun real.

Desde la raíz del repositorio:

```powershell
Copy-Item etl-layer/loadmanager/.env.example etl-layer/loadmanager/.env
./etl-layer/loadmanager/scripts/run-local.ps1
```

Las bases usan `tmpfs`; sus datos se pierden al retirar los contenedores. Para detener y retirar únicamente este entorno de fixtures, usa `docker compose -f infra/dw-integration/dw-integration-test.yml down`. El proceso sigue sin disparar extracciones: `/healthz` y `/readyz` son los endpoints disponibles.

El hash de filas se calcula sobre arrays JSON compactos en el orden SQL estable, delimitados por LF; `byte_count` es el tamaño de esa representación canónica, no el tamaño físico PostgreSQL. El URI del artefacto localiza la tabla RAW y no contiene datos ni credenciales. El fixture DW-008 declara `id_colegio` e `id_loc` como `integer`, mientras el contrato/DDL local esperan `smallint`; el validador acepta ambas representaciones y la columna RAW es `integer` para evitar truncar o corregir el origen. La instancia real aún debe confirmar cuál tipo opera Jachasun.

## Modelos

- `domain.Execution` y `ExecutionEvent` reflejan el `run_id`, tipos y estados definidos en DW-004. `Transition` valida únicamente la máquina de estados en memoria; la persistencia/auditoría corresponde a las funciones de `etl_control`.
- `domain.SourceContract` fija fuente, columnas, clasificación, política de snapshot y orden estable; verifica que las claves de orden estén declaradas.
- `domain.SourceManifest` y `ManifestArtifact` corresponden a la evidencia y hashes de DW-004; una URI con usuario o contraseña embebidos no es válida.
- Pasos, métricas y errores mantienen tipos explícitos y validaciones básicas. Los detalles deben estar saneados antes de persistirse o registrarse en logs.

Los cortes aceptan cualquier código de periodo positivo y no codifican semestres I/II. La política vigente es snapshot completo por cierre; los watermarks quedan fuera de esta base.

## Límite de esta entrega

No se implementan las otras ocho extracciones, cron, API autenticada para iniciar ejecuciones ni la fase ETL de Apache Hop. DW-001 aún requiere validación real y aprobación DSA/TI antes de usar Jachasun.
