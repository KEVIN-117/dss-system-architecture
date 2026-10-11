# Req. 6 — Ejecución incremental y coordinación del backlog

Este documento registra el avance del Req. 6 de la issue #133. Las fases 6.2–6.4 están implementadas y probadas con fixtures sintéticos en Apache Hop 2.19; no equivalen a autorización de producción ni completan por sí solas el Req. 6. El flujo Go/Load Manager continúa pausado y fuera del MVP actual.

## Estado de las fases

| Fase | Estado | Evidencia / criterio de salida |
|---|---|---|
| 6.1 Consultas contractuales de nueve fuentes | Completa en fixture sintético | SQL versionado, explícito, ordenado, filtros de corte probados y principal OLTP de prueba solo lectura. |
| 6.2 Extracción Hop y manifiestos de nueve fuentes | Completa en fixture sintético | Un workflow ejecutó las nueve fuentes; cada una registró manifiesto, filas, huella de consulta/esquema, métrica y paso. |
| 6.3 `DIM_PROGRAMA`, `DIM_MATERIA`, `DIM_PERIODO_ACADEMICO`, `DIM_ADMISION` | Completa en fixture sintético | Cuatro lotes tipados fueron preparados y sellados en el landing privado con conteos esperados; ninguna fila se publicó directamente en `dw`. |
| 6.4 `DIM_ESTUDIANTE` SCD2 | Completa en fixture sintético | Pipeline Hop, hash canónico, corte DSA, transiciones privadas `CLOSE`/`INSERT`, no-cambio, conflicto de identidad, orden temporal y aplicación por publisher atómico probados. |
| 6.5 `fact_admision` y `fact_cursado` | Completa en fixture sintético | Ambos pipelines pasan integración, validan grano/calidad y sellan lotes privados. |
| 6.6 `fact_retencion_desercion` | Completa en fixture sintético | Regla DSA implementada, agregación desde el lote privado de cursado, casos de clasificación y publicación del tercer hecho verificados en Docker. |
| 6.7 Integración y regresión de extremo a extremo | Completa en fixture sintético | Docker ejecutó nueve fuentes, cinco dimensiones, tres hechos, el gate de ocho lotes y la publicación atómica; aserciones verificaron auditoría, conteos y cierre procesado. |
| 6.8 Aprobación operativa | Bloqueada por DSA/TI | Validación real de contratos, cardinalidades/volúmenes, cuenta OLTP read-only y evidencia de operación. |

## Implementación de 6.2

- El workflow `workflows/wf_vertical_uatf_datos_smoke.hwf` invoca nueve pipelines: `uatf_datos`, `alumnos`, `postulantes`, `programas`, `materias`, `notas_planilla`, `facultades`, `colegios` y `localidades`.
- Cada pipeline valida el contrato del fixture, ejecuta su proyección SQL canónica en orden estable y registra por rutinas de `etl_control` manifiesto completo, conteo/métrica y paso. Se registran hashes de query/esquema; no se copian filas OLTP a tablas RAW.
- Postulaciones y notas aplican parámetros tipados para el cierre solicitado; el smoke confirma 3 postulaciones globales y 6 filas de notas en la fuente, y transforma solo las del periodo 2025/2.
- El flujo solo publica cuando las nueve fuentes, cinco dimensiones y tres hechos pasan validación. El publisher atómico es el único que hace visibles los cambios.

## Implementación de 6.3

- Los cuatro pipelines de dimensiones consumen fuentes extraídas, resuelven las claves mediante `etl_control.resolve_hop_dimension_key` y envían filas al landing privado solo a través de `etl_control.stage_hop_publication_row`.
- Cada lote se cuenta y sella con `etl_control.seal_hop_publication_batch`; las pruebas verifican tamaños esperados de programa (2), materia (3), periodo (3) y admisión (2), para 10 filas de staging en total.
- La ejecución usa cierres académicos ficticios para preparar periodos. La cuenta runtime solo lee dichos cierres; no se insertan cierres reales.
- Ninguna de estas cuatro pipelines escribe directamente en `dw`; no ejecutan los hechos.

## Implementación de 6.4

- La migración nueva `0014_add_hop_student_scd2_preparation.sql` instala `etl_control.prepare_hop_student_scd2`, una rutina `SECURITY DEFINER` autorizada para el principal Hop. Las migraciones anteriores permanecen inmutables.
- `pl_dim_estudiante_scd2_mvp.hpl` une el snapshot de `academico.alumnos` con los atributos autorizados de `uatf_datos`, colegios y localidad. El `valid_from` sale del `effective_at` del cierre asociado a `run_id`; una ejecución histórica sin cierre no puede preparar versiones SCD2.
- La identidad usa `RA:<id_ra>` cuando existe; sin `id_ra`, conserva identidad académica provisional `id_alumno`. Asociaciones contradictorias, falta de perfil personal para un RA informado, reversiones temporales y cambios distintos para la misma identidad/fecha se bloquean y requieren reconciliación. No se fusionan identificadores automáticamente.
- El SHA-256 serializa los atributos SCD2 aprobados con longitud en bytes, representación ISO para fechas y una marca distinta para `NULL`; timestamps de procesamiento, `run_id` e identidad no forman parte del hash.
- Hash igual produce cero operaciones; primera observación produce `INSERT`; un cambio posterior produce `CLOSE` de la versión actual y `INSERT` de una nueva. Los dos registros se preparan en el landing privado y solo `publish_hop_staged_run` modifica la dimensión dentro de su transacción atómica.
- Las aserciones cubren tres alumnos sintéticos, versión inicial, replay sin cambio, transición con cambio, cierre de intervalo, actualización física mediante el publisher, identidad ambigua y cierre fuera de orden. La prueba transaccional revierte todos los datos semilla.
- Una persona ausente en el snapshot no se expira automáticamente: la ausencia no se interpreta como baja o egreso.

## Implementación de 6.5

- Las migraciones `0015` y `0016` conservan `0001`–`0014` inmutables y añaden rutinas `SECURITY DEFINER` para preparar los tres hechos sin DML directo del usuario Hop.
- `pl_fact_admision_mvp.hpl` procesa una fila por `public.postulantes.id_alumno`, filtrada por gestión/periodo solicitados y programas aprobados. El DDL local documenta `A` como aprobado y `P` como reprobado; códigos fuera de ese dominio se conservan como desconocidos. La cardinalidad y semántica requieren confirmación en la instancia real/DSA antes de producción.
- `pl_fact_cursado_mvp.hpl` procesa una fila por PK `notas_planilla.id_matricula`, con joins requeridos a alumno, programa y materia, filtro de programa y periodo. Las notas fuera de `[0,100]` bloquean la fila; se conserva `estado` crudo y no se inventan flags mientras DSA/TI no confirme el dominio.
- Los tres flujos resuelven `DIM_ESTUDIANTE` para el `effective_at` del cierre y las dimensiones conformadas preparadas o publicadas. Registran pasos/métricas y sellan conteos contra filas privadas. Solo el publisher atómico hace visibles sus resultados en `dw.fact_*`.
- El smoke ejecuta cinco lotes dimensionales y tres de hechos. En 2025/2, la retención queda `NO_EVALUABLE` porque el cierre 2025/3 aún no se procesó; ese estado no participa en el denominador.
- Evidencia Docker de extremo a extremo: nueve fuentes (el snapshot UATF de 2.002 filas se usa solo para auditoría), cinco dimensiones y tres hechos se prepararon y publicaron atómicamente. Las aserciones confirmaron 9 manifiestos, 8 lotes, conteos de los tres hechos, rechazo de nota fuera de rango, criterios de retención y regresiones SCD2.
- El fixture histórico ahora normaliza `carreras.xlsx.activo` (`A/B`) al dominio contractual `S/N` dentro de `academico.alm_programas`; el catálogo auxiliar preserva `A/B`. Se agregó validación del dominio y un corrector acotado para una base de prueba ya sembrada con la versión previa.
- La integración confirma el MVP contra fixtures sintéticos; no acredita la carga histórica completa 2000–2025 ni autoriza producción. La validación con la instancia real de Jachasun y la aprobación operativa siguen pendientes de DSA/TI.

## Implementación de 6.6

- DSA confirmó la regla: menos de dos parciales rendidos y ausencia de cursado en el siguiente cierre procesado = `DESERTOR`; cursado en ese cierre = `RETENIDO`.
- El siguiente cierre se obtiene del calendario DSA por `effective_at`, no mediante aritmética sobre `periodo`. Si aún no está procesado, fue reabierto o hay empate temporal ambiguo, el snapshot es `NO_EVALUABLE`; también lo es cuando existe evidencia de egreso al corte.
- El cálculo agrega las notas del lote privado de cursado por estudiante/programa/periodo. Un parcial rendido se detecta con el criterio de los análisis SQL ya existentes (`parcial IS NOT NULL AND parcial <> 0`). Las materias aprobadas usan la mejor nota entre final y complementaria (`> 50`); reprobadas usan `(0,50]`. PPA y materias arrastradas permanecen `NULL`, pues su fórmula no está aprobada.
- La población observable es la que tiene al menos una fila de `notas_planilla` para el corte. No se inventan snapshots para estudiantes sin fila de cursado: el contrato actual no aporta un padrón histórico por periodo que permita demostrar su pertenencia a la población evaluable.
- El workflow prepara `FACT_RETENCION_DESERCION`, valida los 9 manifiestos y 8 lotes sellados, y luego invoca la publicación atómica ya existente. Los hechos no se escriben directamente desde Hop.
- La prueba Docker completó el flujo con `dw_hop_runtime`: nueve manifiestos, cinco dimensiones, tres hechos sellados, gate de staging y publisher atómico. Las aserciones confirmaron ejecución `EXITOSA`, el cierre 2025/2 `PROCESADO` ligado al `run_id`, las tres filas de retención `NO_EVALUABLE` mientras 2025/3 no estaba procesado, y las ramas `DESERTOR`, `RETENIDO` y `NO_EVALUABLE`.
- El SCD2 regresivo usa cierres posteriores sintéticos 2025/4 y 2025/5 dentro de una transacción con `ROLLBACK`, evitando reutilizar el cierre 2025/2 que el workflow principal ya procesó.

## Prueba reproducible

En PowerShell, elegir puertos host libres y ejecutar las fases de fixture secuencialmente para evitar que varios servicios de prueba apliquen migraciones concurrentes sobre la misma base:

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

Evidencia histórica de 6.5: el workflow Hop completó la extracción, preparó 5 dimensiones y 2 hechos y registró el gate de retención faltante; la aserción confirmó 9 manifiestos, 7 lotes sellados, 17 filas privadas, rechazo de nota 101 y cero filas publicadas. La prueba SCD2 adicional publicó solo dentro de una transacción de test revertida. `down --volumes` aplica únicamente al proyecto aislado `dss-dw-req65`; nunca usarlo contra otros ambientes.

## Pendientes y límites

- La validación sigue siendo sintética: no es autorización para producción. TI debe contrastar los tipos, nulos, constraint de postulantes, estados y join cross-type de `notas_planilla.id_materia` (`smallint`) con `pln_materias.id_materia` (`integer`) en la instancia real.
- La ejecución actual usa fuentes sintéticas. Aunque el login read-only de Jachasun se confirmó, la validación de tipos, nulabilidad, cardinalidad, volumen y planes sobre la instancia real requiere evidencia acordada con TI y horario seguro.
- No congelar dominios de `postulantes.estado` o `notas_planilla.estado` sin aprobación. No inventar ceros, puntajes, egreso, PPA, repetición, deserción ni medidas derivadas.
- No implementar `fact_enrollment` ni `fact_graduation` en el MVP. La graduación oficial futura se investigará con `actas_graduacion.graduados`.
- Ningún resultado sintético habilita cargas productivas. Publicación permanece detrás del publisher atómico del Req. 5 y solo tras pasar todos los gates.
