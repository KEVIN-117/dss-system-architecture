# Hechos del MVP

Implementar y validar por separado los granos definidos en `docs/dw/dimensional-model.md` y `0009_create_constellation_facts.sql`:

- `fact_admision`: una fila por `public.postulantes.id_alumno`; el DDL local de Jachasun declara `UNIQUE (id_alumno)`. `dw.fact_admision` aplica esa clave operacional desde la migración 0015. Confirmar la misma restricción en la instancia real con TI antes de cargas productivas.
- `fact_cursado`: una fila por `academico.notas_planilla.id_matricula`, PK local en Jachasun; `estado` se conserva sin mapear porque el DDL no publica su dominio.
- `fact_retencion_desercion`: un snapshot por estudiante/programa/periodo cerrado; `NO_EVALUABLE` conserva deserción nula y queda fuera del denominador.

No cargar `fact_enrollment` ni `fact_graduation` en el MVP. No escribir estos destinos directamente desde Hop: preparar filas aisladas por `run_id` y esperar la rutina de publicación atómica antes de persistirlas en las tablas visibles.

## Flujos Hop de 6.5–6.6

- `pl_fact_admision_mvp.hpl` filtra postulaciones al `(P_REQUESTED_GESTION, P_REQUESTED_PERIODO)` autorizado, limita programas según DW-001, ordena por `id_alumno` y llama `etl_control.stage_hop_fact_admission`. El workflow espera a que termine esa acción y luego ejecuta `pl_seal_fact_admision_batch.hpl`; esa frontera confirma las escrituras antes de que PostgreSQL cuente y selle el lote.
- Para resolver `DIM_ESTUDIANTE`, `id_alumno` es la identidad canónica compartida por postulantes y alumnos; el `id_ra` de postulantes no se usa como condición adicional porque puede diferir o no estar informado en `academico.alumnos`. En `FACT_ADMISION`, una postulación sin registro en `academico.alumnos` usa `estudiante_sk=-1` (`UNKNOWN`); si el alumno sí existe pero no tiene una versión SCD2 vigente al corte, la ejecución falla. `FACT_CURSADO` mantiene resolución estricta. Esta regla se aplica desde la migración 0018.
- `pl_fact_cursado_mvp.hpl` une notas a alumno, programa y materia, aplica el mismo filtro/corte y ordena por PK `id_matricula`; la rutina de staging valida notas dentro de `[0,100]` y claves SCD2 vigentes al `effective_at` del cierre. El lote se sella después de la acción de staging, mediante `pl_seal_fact_cursado_batch.hpl`, por la misma razón de visibilidad transaccional.
- `pl_fact_retencion_desercion_mvp.hpl` consume el lote privado de cursado y agrega por estudiante/programa/periodo. Evalúa continuidad exclusivamente contra el siguiente cierre DSA ya procesado.

Para ejecutar una prueba de un hecho de forma aislada, correr primero su pipeline de preparación (`pl_fact_admision_mvp.hpl` o `pl_fact_cursado_mvp.hpl`) y luego su pipeline `pl_seal_*_batch.hpl` con el mismo `P_RUN_ID`. En operación normal, `wf_vertical_uatf_datos_smoke.hwf` encadena ambas acciones y no se debe omitir el sellado. No se debe volver a ejecutar un intento fallido con el mismo UUID.
- El comentario del DDL Jachasun describe `postulantes.estado`: `A = EN CASO DE APROBADOS`, `P = EN CASO DE REPROBADOS`. El MVP mapea únicamente A/P a booleanos; otros/null se conservan como desconocidos. No deriva flags de `notas_planilla.estado` sin dominio confirmado.
- Los tres hechos se preparan y sellan en `etl_work`; la validación de staging verifica hashes, conteos, manifiestos y pasos antes de llamar al publisher atómico. `FACT_RETENCION_DESERCION` usa menos de dos parciales y ausencia de cursado en el siguiente cierre procesado para clasificar deserción; sin evidencia temporal suficiente devuelve `NO_EVALUABLE`.
- `materias_arrastradas` y `ppa_acumulado` se mantienen `NULL` hasta que DSA apruebe fórmulas y dominios. `NO_EVALUABLE` nunca se interpreta como cero ni participa en tasas.
