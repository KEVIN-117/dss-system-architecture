# Workflows de `dss-uatf-etl`

## Sincronización del catálogo académico de Auth Service

`wf_sync_academic_catalog.hwf` sincroniza primero `academico.alm_programas_facultades` y después `academico.alm_programas` hacia `public.academic_faculties` y `public.academic_programs` usando la conexión Hop `Auth Service DB`. Cada pipeline verifica el contrato de columnas/tipos/PK, un snapshot no vacío y las reglas de calidad antes de escribir. Los programas `CAR`, `PRO`, `TES` y `TEM` se filtran con el dominio activo aprobado (`1`, `S`, `Y`), igual que el contrato DW-001. Otros estados del fixture (`A`, `B`, `X`) quedan fuera del snapshot; no se infiere su significado ni se modifican filas locales por su ausencia.

Los upserts usan `faculty_id` e `id_programa` (`CHAR(3)`) como claves naturales y actualizan `last_synced_at`. Ningún paso ejecuta `DELETE`, `TRUNCATE` ni modifica filas locales por mera ausencia del snapshot. El estado de facultad se conserva como `source_status`, pero `is_active` queda true para facultades presentes: el contrato fuente no define la semántica de `estado`. Una reubicación de programa puede ser bloqueada por la FK compuesta cuando un contexto de usuario aún referencia la pareja anterior; hay que reconciliar ese contexto en vez de quitar la restricción.

Los pipelines se ejecutan secuencialmente y son repetibles. La escritura de facultades puede quedar confirmada si falla la carga posterior de programas; al corregir la causa se vuelve a ejecutar el workflow completo. La ejecución requiere que el perfil Hop seleccionado defina `AUTH_CATALOG_DB_*` y que `hop_academic_catalog` conserve solo sus permisos mínimos de `SELECT`/`INSERT`/`UPDATE` en las tablas de catálogo.

`pipelines/catalog/pl_sync_academic_faculties.hpl` y `pl_sync_academic_programs.hpl` implementan las validaciones y upserts. El workflow puede abrirse en Hop Web desde `workflows/wf_sync_academic_catalog.hwf`.

### Regresión aislada del catálogo

La regresión ejecuta el workflow dos veces contra una base Auth temporal inicializada con las migraciones reales del servicio. Verifica que la primera carga genere las dos facultades y dos carreras esperadas, que los vínculos carrera-facultad respeten la FK, y que la repetición mantenga el mismo catálogo. También confirma que el principal de Hop no tenga permiso `DELETE`. La base usa `tmpfs` y el usuario/contraseña del fixture son desechables.

```powershell
$f = "infra/dw-integration/dw-integration-test.yml"
$p = "dss-dw-catalog-sync"
docker compose -p $p -f $f up -d jachasun-fixture auth-catalog-fixture
docker compose -p $p -f $f --profile academic-catalog-sync run --rm --no-deps hop-catalog-initial-test
docker compose -p $p -f $f --profile academic-catalog-sync run --rm --no-deps hop-catalog-initial-assert
docker compose -p $p -f $f --profile academic-catalog-sync run --rm --no-deps hop-catalog-replay-test
docker compose -p $p -f $f --profile academic-catalog-sync run --rm --no-deps hop-catalog-replay-assert
docker compose -p $p -f $f down --volumes --remove-orphans
```

Ejecuta el último comando incluso si alguna aserción falla; solo elimina los recursos del proyecto aislado `dss-dw-catalog-sync`.

El workflow `wf_vertical_uatf_datos_smoke.hwf` integra con fixtures las fases 6.2–6.6: extrae/audita nueve fuentes, prepara cinco dimensiones y tres hechos en el landing privado, verifica integridad y llama al publisher atómico. Solo ese publisher hace visibles las dimensiones/hechos y completa el cierre y la ejecución.

## Secuencia del smoke

1. Recibe un UUID de prueba nuevo y crea/inicia una ejecución asociada al cierre sintético 2025/2 mediante las rutinas autorizadas.
2. Ejecuta, secuencialmente, `pl_source_uatf_datos_vertical`, `pl_source_alumnos_vertical`, `pl_source_postulantes_vertical`, `pl_source_programas_vertical`, `pl_source_materias_vertical`, `pl_source_notas_planilla_vertical`, `pl_source_facultades_vertical`, `pl_source_colegios_vertical` y `pl_source_localidades_vertical`.
3. Cada fuente valida contrato, realiza lectura ordenada, y registra manifiesto, hash de consulta/esquema, conteo, métrica y paso a través de `etl_control`; no persiste filas personales.
4. Ejecuta preparación privada de `DIM_PROGRAMA`, `DIM_MATERIA`, `DIM_PERIODO_ACADEMICO` y `DIM_ADMISION`; sella `DIM_ADMISION` en una acción posterior para registrar también lotes válidos de cero filas.
5. `pl_dim_estudiante_scd2_mvp.hpl` usa el `effective_at` del cierre DSA, calcula identidad/hash de los atributos historizables y prepara `INSERT`, `CLOSE` + `INSERT` o ningún cambio mediante APIs autorizadas.
6. `pl_fact_admision_mvp.hpl` filtra `postulantes` por el corte y grano `id_alumno`; `pl_fact_cursado_mvp.hpl` filtra el mismo periodo, une notas con alumno/programa/materia y respeta el grano `id_matricula`. Ambos validan/resuelven claves mediante rutinas restringidas y sellan sus lotes privados.
7. `pl_fact_retencion_desercion_mvp.hpl` produce un snapshot por estudiante/programa/periodo; sin siguiente cierre procesado o con egreso conocido marca `NO_EVALUABLE`.
8. `pl_hop_mark_vertical_ready.hpl` exige nueve manifiestos completos, ocho lotes sellados e íntegros, sin errores bloqueantes y con pasos previos exitosos.
9. `pl_hop_publish_staged_run.hpl` publica el conjunto completo en una sola transacción. Ante fallo, se audita el intento y la publicación previa permanece intacta.
10. Ante fallo en cualquier preparación, se propaga el `run_id` y usa la ruta de auditoría de error.

Los cierres usados por la integración Docker son sintéticos y solo existen en la base de prueba. El responsable del proyecto confirmó el login OLTP de solo lectura. La prueba integrada certifica el flujo con fixtures; una ejecución productiva debe usar el endpoint y la cuenta autorizados del ambiente y el corte formalmente aprobado.

## Ejecutar 6.2–6.7 con Docker

PowerShell (seleccionar puertos host libres):

```powershell
$env:DW_INTEGRATION_SOURCE_PORT = "26532"
$env:DW_INTEGRATION_TARGET_PORT = "26533"
$f = "infra/dw-integration/dw-integration-test.yml"
docker compose -p dss-dw-req65 -f $f down --volumes
docker compose -p dss-dw-req65 -f $f up -d postgres-dw jachasun-fixture
docker compose -p dss-dw-req65 -f $f run --rm integration-test
docker compose -p dss-dw-req65 -f $f --profile dw-vertical run --rm --no-deps hop-vertical-integration-test
docker compose -p dss-dw-req65 -f $f --profile dw-vertical run --rm --no-deps hop-vertical-assert
```

La aserción final confirma nueve manifiestos, cinco lotes dimensionales, tres lotes fact (para 2025/2: una postulación, tres intentos y tres snapshots), y publicación atómica completa. Dado que 2025/3 aún no está procesado en el fixture, los tres snapshots son `NO_EVALUABLE`. Además, la prueba de SCD2 revierte sus cambios de publicación. Los servicios de migración se ejecutan en secuencia para evitar DDL concurrente; `down --volumes` se limita al proyecto aislado con datos sintéticos.

## Otros contratos

El workflow de publicación de prueba usa nueve manifiestos y ocho lotes preparados artificialmente para probar atomicidad del publisher; no es la ejecución de transformación real. Los parámetros comunes son `P_RUN_ID`, `P_EXECUTION_KIND`, `P_CLOSURE_ID`, `P_RETRY_OF_RUN_ID`, `P_REQUESTED_GESTION`, `P_REQUESTED_PERIODO`, `P_REQUESTED_CUT_AT` y `P_REQUEST_REASON`. Las conexiones vienen de metadata `OLTP db` (solo lectura) y `DSS DW`.

Consultar `docs/dw/hop-execution-contract.md` para el contrato y `docs/dw/hop-req-6-progress.md` para el informe de cierre del Req. 6. Validación estática del proyecto: `python etl-layer/apache-hop/scripts/validate_project.py`.
