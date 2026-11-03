# PRED-006 — Experimentos sintéticos de abandono

**Estado:** experimentación técnica con Faker; no es evaluación institucional ni autoriza activar modelos.

## Objetivos separados

| Objetivo | Grano | Etiqueta simulada | Features usadas |
|---|---|---|---|
| Abandono de materia | Estudiante–materia–período | `dw.fact_cursado.es_abandono` | Ciclo/nivel de materia e historial agregado de cursados/abandonos en períodos anteriores. Se excluyen notas y estado de la materia objetivo. |
| Abandono del programa | Estudiante–programa–corte | `DESERTOR` frente a `RETENIDO` en `dw.fact_retencion_desercion` | `materias_cursadas`, `materias_aprobadas`, `materias_reprobadas` observadas al corte. |

La cohorte experimental incluye los tres primeros años académicos desde el primer cursado procesado de cada estudiante–programa: tres cortes anuales o seis semestrales. Los registros con cadencia mixta se excluyen. Los objetivos no se combinan porque tienen distinto grano, evento y momento de observación.

## Disponibilidad del flag de materia

El DW tenía `es_abandono` nulo en sus 107.109 hechos de cursado. La migración `0033_map_course_abandonment_flag.sql` cambia el mapeo del ETL: estados documentados `X`/`I` son abandono formal; `A`/`R`/`H`/`C`/`S`/`D` son no abandono; `U`/`Z`/`T` y códigos no reconocidos permanecen nulos. Así, un código ambiguo nunca se convierte en clase negativa.

`infra/dw-test-data/backfill_faker_course_abandonment.sql` aplica ese mapeo a hechos Faker ya cargados. Está protegido para requerir la base local `dss_dw` y la variable de sesión `dw_test.allow_faker_course_label_backfill=on`. La ejecución local dejó 8.192 abandonos formales (`X`) y 98.917 estados conocidos no abandono (`A`/`R`). Los códigos ambiguos no estaban presentes en este seed.

## Resultado de los experimentos Faker

RF y XGBoost compartieron snapshot y partición por objetivo/cadencia. La partición agrupó por estudiante, reservó cortes futuros para holdout y excluyó del entrenamiento el historial previo de estudiantes del holdout. El test se usó únicamente para la métrica final; la selección comparó resultados de validación. Sin una política de costes aprobada, el umbral se eligió de forma descriptiva por recall y F1.

| Objetivo | Cadencia | Filas | `RISK` | Holdout | Resultado de comparación |
|---|---:|---:|---:|---:|---|
| Materia | Semestral | 61.951 | 4.997 | 13.222 | Empate de validación |
| Materia | Anual | 26.485 | 2.643 | 6.179 | Empate de validación |
| Programa | Semestral | 17.562 | 855 | 3.826 | Empate de validación |
| Programa | Anual | 5.513 | 243 | 1.144 | RF seleccionado por validación |

Las cuatro comparaciones reportan `EVIDENCIA_INSUFICIENTE` y `deployment_allowed=false`; incluso el RF anual seleccionado es solo un resultado de validación sintética. Los artefactos son `CANDIDATE`, están en `prediction-service/.test-tmp/pred006_faker_targets_v2/` y no se copiaron al volumen de modelos activos.

## Reproducción local

Después de aplicar migraciones en el DW Faker, el backfill de prueba puede ejecutarse con esta sesión explícita:

```powershell
$sql = "SET dw_test.allow_faker_course_label_backfill = 'on';`n" + (Get-Content -Raw .\infra\dw-test-data\backfill_faker_course_abandonment.sql)
$sql | docker exec -i postgres-dw psql -X -v ON_ERROR_STOP=1 -U admin -d dss_dw
```

Generar los snapshots seudonimizados, comparar los dos algoritmos por cadencia y guardar los artefactos de desarrollo:

```powershell
cd prediction-service
uv run python scripts/run_pred006_faker_experiments.py
```

El extractor consulta el DW dentro de una transacción de solo lectura y escribe los snapshots únicamente bajo `.test-tmp`. Los identificadores de estudiante, programa y materia se convierten a referencias hash antes de persistirse.

## Integración de inferencia

`POST /v1/predictions` acepta `event_type=course_abandonment` con `course_ref` o `event_type=program_dropout` sin materia. El registry resuelve modelos por evento y cadencia, y el adaptador DW limita ambas cohortes a tres años académicos (tres cortes anuales o seis semestrales). La ruta no persiste resultados; publicación analítica queda en PRED-007.

La fuente `dw.fact_cursado` se produce al cerrar/procesar el período y no contiene un timestamp de disponibilidad de la inscripción anterior al resultado. Por ello la ruta técnica puede leer datos únicamente cuando ese hecho existe, pero eso no prueba una predicción prospectiva durante el cursado. Para habilitar uso oportuno, hace falta que DW publique la inscripción/carga de materias con un corte disponible al inicio del período. No usar esta limitación como autorización para desplegar los modelos Faker.
