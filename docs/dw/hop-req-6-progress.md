# Req. 6 — Ejecución incremental y coordinación del backlog

Este documento registra el avance del Req. 6 de la issue #133. Las fases 6.2–6.4 están implementadas y probadas con fixtures sintéticos en Apache Hop 2.19; no equivalen a autorización de producción ni completan por sí solas el Req. 6. El flujo Go/Load Manager continúa pausado y fuera del MVP actual.

## Estado de las fases

| Fase | Estado | Evidencia / criterio de salida |
|---|---|---|
| 6.1 Consultas contractuales de nueve fuentes | Completa en fixture sintético | SQL versionado, explícito, ordenado, filtros de corte probados y principal OLTP de prueba solo lectura. |
| 6.2 Extracción Hop y manifiestos de nueve fuentes | Completa en fixture sintético | Un workflow ejecutó las nueve fuentes; cada una registró manifiesto, filas, huella de consulta/esquema, métrica y paso. |
| 6.3 `DIM_PROGRAMA`, `DIM_MATERIA`, `DIM_PERIODO_ACADEMICO`, `DIM_ADMISION` | Completa en fixture sintético | Cuatro lotes tipados fueron preparados y sellados en el landing privado con conteos esperados; ninguna fila se publicó directamente en `dw`. |
| 6.4 `DIM_ESTUDIANTE` SCD2 | Completa en fixture sintético | Pipeline Hop, hash canónico, corte DSA, transiciones privadas `CLOSE`/`INSERT`, no-cambio, conflicto de identidad, orden temporal y aplicación por publisher atómico probados. |
| 6.5 `fact_admision` y `fact_cursado` | Completa en fixture sintético | Dos pipelines Hop consultan el corte autorizado, resuelven claves temporales, validan calidad y sellan lotes privados; Retención sigue bloqueando publicación. |
| 6.6 `fact_retencion_desercion` | Bloqueada por decisión funcional DSA | Aprobar continuidad entre cierres, egreso y dominio de estados; `NO_EVALUABLE` debe excluirse del denominador. |
| 6.7 Integración y regresión de extremo a extremo | Pendiente | Éxito/fallo por fase, nuevo `run_id` en retry, persistencia de publicación previa y permisos mínimos. |
| 6.8 Aprobación operativa | Bloqueada por DSA/TI | Validación real de contratos, cardinalidades/volúmenes, cuenta OLTP read-only y evidencia de operación. |

## Implementación de 6.2

- El workflow `workflows/wf_vertical_uatf_datos_smoke.hwf` invoca nueve pipelines: `uatf_datos`, `alumnos`, `postulantes`, `programas`, `materias`, `notas_planilla`, `facultades`, `colegios` y `localidades`.
- Cada pipeline valida el contrato del fixture, ejecuta su proyección SQL canónica en orden estable y registra por rutinas de `etl_control` manifiesto completo, conteo/métrica y paso. Se registran hashes de query/esquema; no se copian filas OLTP a tablas RAW.
- Postulaciones y notas aplican parámetros tipados para el cierre solicitado; el smoke confirma 3 postulaciones globales y 6 filas de notas en la fuente, y transforma solo las del periodo 2025/2.
- El flujo no tiene salida publicable: después de extracción y preparación de dimensiones se registra deliberadamente un gate incompleto/fallido.

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

- La migración nueva `0015_add_hop_fact_preparation.sql` conserva `0001`–`0014` inmutables, alinea `dw.fact_admision.id_alumno_origen` a la restricción `UNIQUE (id_alumno)` hallada en el DDL local y añade rutinas `SECURITY DEFINER` para resolver surrogate keys/preparar hechos sin DML directo del usuario Hop.
- `pl_fact_admision_mvp.hpl` procesa una fila por `public.postulantes.id_alumno`, filtrada por gestión/periodo solicitados y programas aprobados. El DDL local documenta `A` como aprobado y `P` como reprobado; códigos fuera de ese dominio se conservan como desconocidos. La cardinalidad y semántica requieren confirmación en la instancia real/DSA antes de producción.
- `pl_fact_cursado_mvp.hpl` procesa una fila por PK `notas_planilla.id_matricula`, con joins requeridos a alumno, programa y materia, filtro de programa y periodo. Las notas fuera de `[0,100]` bloquean la fila; se conserva `estado` crudo y no se inventan flags mientras DSA/TI no confirme el dominio.
- Ambos flujos resuelven `DIM_ESTUDIANTE` para el `effective_at` del cierre y las dimensiones conformadas preparadas o publicadas. Registran pasos/métricas y sellan conteos contra las filas privadas reales. Solo `etl_work.hop_publication_row` recibe los resultados; las tablas `dw.fact_*` permanecen vacías.
- El smoke ahora verifica cinco lotes dimensionales y dos lotes de hechos (1 admisión y 3 intentos de cursado para 2025/2). El gate sigue terminando `FALLIDA` deliberadamente porque no se preparó `FACT_RETENCION_DESERCION`; por tanto, no llama al publisher ni expone un DW parcial.

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

Resultado verificado: el workflow Hop completó la extracción, preparó 5 dimensiones y 2 hechos, y registró el gate de retención faltante; la aserción confirmó 9 manifiestos, 7 lotes sellados, 17 filas privadas, rechazo de nota 101 y cero filas publicadas. La prueba SCD2 adicional ejecuta publicación solo dentro de una transacción de test que termina en `ROLLBACK`. `down --volumes` se limita al proyecto nombrado `dss-dw-req65`, dedicado a fixtures desechables; nunca usarlo contra otros proyectos/ambientes.

## Pendientes y límites

- La validación sigue siendo sintética: no es autorización para producción. TI debe contrastar los tipos, nulos, constraint de postulantes, estados y join cross-type de `notas_planilla.id_materia` (`smallint`) con `pln_materias.id_materia` (`integer`) en la instancia real.
- La ejecución actual usa fuentes sintéticas. Aunque el login read-only de Jachasun se confirmó, la validación de tipos, nulabilidad, cardinalidad, volumen y planes sobre la instancia real requiere evidencia acordada con TI y horario seguro.
- No congelar dominios de `postulantes.estado` o `notas_planilla.estado` sin aprobación. No inventar ceros, puntajes, egreso, PPA, repetición, deserción ni medidas derivadas.
- No implementar `fact_enrollment` ni `fact_graduation` en el MVP. La graduación oficial futura se investigará con `actas_graduacion.graduados`.
- Ningún resultado sintético habilita cargas productivas. Publicación permanece detrás del publisher atómico del Req. 5 y solo tras pasar todos los gates.
