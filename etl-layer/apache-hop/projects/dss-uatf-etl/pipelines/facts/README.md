# Hechos del MVP

Implementar y validar por separado los granos definidos en `docs/dw/dimensional-model.md` y `0009_create_constellation_facts.sql`:

- `fact_admision`: una fila por `public.postulantes.id_alumno`; el DDL local de Jachasun declara `UNIQUE (id_alumno)`. `dw.fact_admision` aplica esa clave operacional desde la migración 0015. Confirmar la misma restricción en la instancia real con TI antes de cargas productivas.
- `fact_cursado`: una fila por `academico.notas_planilla.id_matricula`, PK local en Jachasun; `estado` se conserva sin mapear porque el DDL no publica su dominio.
- `fact_retencion_desercion`: un snapshot por estudiante/programa/periodo cerrado; `NO_EVALUABLE` conserva deserción nula y queda fuera del denominador.

No cargar `fact_enrollment` ni `fact_graduation` en el MVP. No escribir estos destinos directamente desde Hop: preparar filas aisladas por `run_id` y esperar la rutina de publicación atómica antes de persistirlas en las tablas visibles.

## Flujos Hop de 6.5

- `pl_fact_admision_mvp.hpl` filtra postulaciones al `(P_REQUESTED_GESTION, P_REQUESTED_PERIODO)` autorizado, limita programas según DW-001, ordena por `id_alumno` y llama `etl_control.stage_hop_fact_admission`.
- `pl_fact_cursado_mvp.hpl` une notas a alumno, programa y materia, aplica el mismo filtro/corte y ordena por PK `id_matricula`; la rutina de staging valida notas dentro de `[0,100]` y claves SCD2 vigentes al `effective_at` del cierre.
- El comentario del DDL Jachasun describe `postulantes.estado`: `A = EN CASO DE APROBADOS`, `P = EN CASO DE REPROBADOS`. El MVP mapea únicamente A/P a booleanos; otros/null se conservan como desconocidos. No deriva flags de `notas_planilla.estado` sin dominio confirmado.
- Los hechos se preparan y sellan en `etl_work`; el workflow no ejecuta el publisher. El gate final continúa fallando intencionalmente mientras falte `FACT_RETENCION_DESERCION`.
