# Apache Hop — lectura del bundle RAW

## Flujo DW-012

`workflows/main_orchestrator.hwf` es la entrada soportada para probar el bundle RAW:

1. Recibe `RUN_ID` como parámetro requerido.
2. Ejecuta `/usr/local/bin/verify-raw-bundle.sh`, que llama al binario `raw-verify` y consulta la evidencia con el principal de solo lectura `dw_raw_verifier`.
3. Solo si el preflight termina con código cero, ejecuta `pipelines/pl_read_raw_bundle.hpl`.
4. El pipeline abre por separado los nueve directorios `source=<schema.object>/run_id=<RUN_ID>`, con una transformación terminal por contrato. Lee todas las partes `.jsonl.gz` en UTF-8 y descomprime GZip. Cada línea completa se recibe en el campo `json_record`; las transformaciones no envían filas a otro paso, no las loguean ni escriben en tablas.
5. Si falta un manifiesto/archivo, no coincide un hash/conteo o el lector no puede descomprimir un archivo, la ruta va a `Abort on RAW error`.

El pipeline de lectura es deliberadamente un smoke test/ingress técnico: la validación JSON completa la hace `raw-verify`. El mapeo JSON a campos de negocio, controles de calidad ETL y la escritura a dimensiones/hechos no están incluidos aquí.

## Requisitos de ejecución

- Construir la imagen local `dss-hop-web` definida en `Dockerfile`; contiene Hop Web y el binario Go `raw-verify`.
- En el entorno Compose, configurar `DB_DW_VERIFY_USER` y `DB_DW_VERIFY_PASS` para una cuenta LOGIN miembro de `dw_raw_verifier`. El rol de grupo se crea en la migración `0008`; TI/DBA debe aprovisionar el login. No reutilizar las credenciales de extracción/publicación.
- `hop-web` se conecta a PostgreSQL por el nombre de servicio `postgres-dw` y puerto interno `5432`; el puerto publicado en el host no se usa desde el contenedor.
- El volumen `dw-raw` se monta read-only en Hop en `/dw-raw`.
- El `RUN_ID` debe corresponder a un snapshot con los nueve manifiestos requeridos y `etl_control.etl_execution_step.step_code = 'verify_raw_bundle'` exitoso.

## Ejecución

Desde la raíz del repositorio, con la base DW migrada y el bundle ya extraído:

```powershell
docker compose build hop-web
docker compose up -d postgres-dw dw-migrator hop-web
```

Abre Hop Web en `http://localhost:8081`, abre `workflows/main_orchestrator.hwf`, ejecuta el workflow indicando `RUN_ID=<UUID>`, y verifica en el log:

- `RAW bundle eligible: run_id=... sources=9 ...`
- finalización exitosa del pipeline `pl_read_raw_bundle`;
- ausencia de errores en el workflow.

La validación estática de contratos XML, rutas de fallo y los nueve directorios se puede repetir en PowerShell:

```powershell
./etl-layer/apache-hop/scripts/validate-raw-workflow.ps1
```

Para probar el mismo flujo end-to-end con los fixtures sintéticos (sin Jachasun real), usa el perfil aislado de integración. Este servicio construye el target `hop-runner`, basado en `apache/hop`, y deja intacto su entrypoint oficial: este registra el proyecto/entorno a partir de las variables `HOP_*` y ejecuta `HOP_FILE_PATH` con `HOP_RUN_CONFIG`. No reemplaces el entrypoint por una llamada directa a `hop-run.sh`, porque eso omite el registro del entorno lifecycle `dev`. `apache/hop-web` es la imagen interactiva y no se usa como runner efímero.

```powershell
$f = "infra/dw-integration/dw-integration-test.yml"
docker compose -f $f --profile dw-012-hop build raw-extract-hop-fixture hop-raw-integration-test
docker compose -f $f --profile dw-012-hop run --rm hop-raw-integration-test
docker compose -f $f --profile dw-012-hop logs hop-raw-integration-test raw-extract-hop-fixture
```

El test crea un snapshot sintético con UUID `DW012_HOP_TEST_RUN_ID` (por defecto `01234567-89ab-cdef-0123-456789abcdef`), comparte el mismo valor entre el extractor y Hop, lo verifica y ejecuta el lector. Usa el lifecycle `integration` y `config/environments/integration-env.json`, separado del `dev-env.json` local para que sus variables no redirijan el preflight a otra base. El script acepta el parámetro `RUN_ID` del workflow y, si Hop lo expande como vacío en la acción Shell, usa la variable de entorno de respaldo del servicio. Deben aparecer `RAW bundle eligible: ... sources=9` y un código de salida cero para el contenedor Hop. Como el test usa una ejecución y un volumen con datos persistentes, para repetirlo desde cero elimina únicamente el entorno y volumen de fixtures con `docker compose -f $f --profile dw-012-hop down --volumes`.

También puede ejecutarse con Hop Run desde el contenedor, con el proyecto y entorno cargados:

```bash
hop-run.sh -j dss-uatf -e dev -r local \
  -f /files/project/workflows/main_orchestrator.hwf \
  -p RUN_ID=<UUID>
```

La imagen de ejecución oficial `apache/hop` instala Hop bajo `/opt/hop`; su entrypoint oficial configura proyectos y entornos y después ejecuta el workflow si se definen `HOP_FILE_PATH` y `HOP_RUN_CONFIG`. La imagen `apache/hop-web` se reserva para el servicio interactivo de desarrollo.

## Límites y legado

`workflows/wf_carga_dimensiones.hwf`, `workflows/wf_carga_hechos.hwf` y sus pipelines preexistentes son prototipos legacy que consultan OLTP y apuntan a `public.*`; no se invocan desde `main_orchestrator.hwf`. No ejecutar esos workflows como carga DW-012. Su migración para consumir RAW y publicar en `dw.*` se hará después de aprobar los mapeos dimensionales.

La prueba con fixtures debe usar el Compose aislado de `infra/dw-integration`; la imagen Hop de desarrollo no debe conectarse a producción hasta la aprobación de contratos y de DSA/TI.
