# Workflows de `dss-uatf-etl`

El workflow `wf_vertical_uatf_datos_smoke.hwf` integra con fixtures las fases 6.2–6.5: extrae/audita las nueve fuentes, prepara cinco dimensiones conformadas y prepara `FACT_ADMISION`/`FACT_CURSADO` en el landing privado. No publica por el smoke y termina intencionalmente no publicable porque falta `FACT_RETENCION_DESERCION`.

## Secuencia del smoke

1. Recibe un UUID de prueba nuevo y crea/inicia una ejecución asociada al cierre sintético 2025/2 mediante las rutinas autorizadas.
2. Ejecuta, secuencialmente, `pl_source_uatf_datos_vertical`, `pl_source_alumnos_vertical`, `pl_source_postulantes_vertical`, `pl_source_programas_vertical`, `pl_source_materias_vertical`, `pl_source_notas_planilla_vertical`, `pl_source_facultades_vertical`, `pl_source_colegios_vertical` y `pl_source_localidades_vertical`.
3. Cada fuente valida contrato, realiza lectura ordenada, y registra manifiesto, hash de consulta/esquema, conteo, métrica y paso a través de `etl_control`; no persiste filas personales.
4. Ejecuta preparación privada de `DIM_PROGRAMA`, `DIM_MATERIA`, `DIM_PERIODO_ACADEMICO` y `DIM_ADMISION`.
5. `pl_dim_estudiante_scd2_mvp.hpl` usa el `effective_at` del cierre DSA, calcula identidad/hash de los atributos historizables y prepara `INSERT`, `CLOSE` + `INSERT` o ningún cambio mediante APIs autorizadas.
6. `pl_fact_admision_mvp.hpl` filtra `postulantes` por el corte y grano `id_alumno`; `pl_fact_cursado_mvp.hpl` filtra el mismo periodo, une notas con alumno/programa/materia y respeta el grano `id_matricula`. Ambos validan/resuelven claves mediante rutinas restringidas y sellan sus lotes privados.
7. El workflow registra el gate no publicable porque falta `FACT_RETENCION_DESERCION`. No hay camino que marque este smoke como éxito de negocio ni publique dimensiones/hechos.
7. Ante fallo de etapa, propaga el `run_id` y usa la ruta de auditoría de error. La publicación completa se mantiene en `wf_hop_publish_staged_run.hwf`, separada de este smoke.

Los periodos usados por esta integración son cierres ficticios y solo existen en la base de prueba. La confirmación de un login OLTP read-only no reemplaza la aprobación/evidencia de esquema, cardinalidad, volumen y planes de consulta en Jachasun real.

## Ejecutar 6.2–6.5 con Docker

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

La aserción final confirma nueve manifiestos, cinco lotes dimensionales, dos lotes fact (para 2025/2: una postulación y tres intentos), diecisiete filas privadas, rechazo de nota 101 y cero filas publicadas; la ejecución termina FALLIDA intencionalmente por faltar el hecho de retención. Además prueba el publisher SCD2 para el par CLOSE/INSERT en una transacción completamente revertida. Los servicios de migración se ejecutan en secuencia para no aplicar migraciones concurrentes a la misma base. El `down --volumes` inicial aplica únicamente al proyecto aislado `dss-dw-req65` con datos sintéticos.

## Otros contratos

El workflow de publicación de prueba usa nueve manifiestos y ocho lotes preparados artificialmente para probar atomicidad del publisher; no es la ejecución de transformación real. Los parámetros comunes son `P_RUN_ID`, `P_EXECUTION_KIND`, `P_CLOSURE_ID`, `P_RETRY_OF_RUN_ID`, `P_REQUESTED_GESTION`, `P_REQUESTED_PERIODO`, `P_REQUESTED_CUT_AT` y `P_REQUEST_REASON`. Las conexiones vienen de metadata `OLTP db` (solo lectura) y `DSS DW`.

Consultar `docs/dw/hop-execution-contract.md` para el contrato de ejecución, y `docs/dw/hop-req-6-progress.md` para el avance y límites del Req. 6. Validación estática: `python etl-layer/apache-hop/scripts/validate_project.py`.
