# PRED-002 — Comprensión de datos académicos

**Estado:** evidencia de esquema; no contiene perfil estadístico de datos institucionales.
**Fuente de evidencia:** migraciones versionadas del DW en `infra/dw-schema/migrations/`.

## Fuentes DW candidatas

| Fuente | Grano / relación | Uso candidato | Límites identificados |
|---|---|---|---|
| `dw.fact_retencion_desercion` | Una fila por estudiante, programa y periodo académico; `closure_id` vincula el corte autorizado | Resultado observado y resumen académico del snapshot | El target ML, horizonte y población no están aprobados; una etiqueta puede depender del siguiente cierre procesado |
| `dw.fact_cursado` | Una fila por matrícula/intentado según `id_matricula_origen`; se vincula a estudiante, programa, materia y periodo | Construcción de variables históricas hasta un corte | Agregar solo con joins temporales y reglas aprobadas; no sumar hechos de periodos posteriores |
| `dw.dim_estudiante` | Identidad con versiones SCD2 | Identidad académica e historia de atributos | `estudiante_sk` es versionado; no agrupa por sí solo a la misma persona a través del tiempo. `identity_key` contiene identificadores naturales y es sensible |
| `dw.dim_programa` | Programa académico | Contexto de facultad/carrera y filtro institucional | Verificar pertenencia y vigencia del programa en el corte |
| `dw.dim_periodo_academico` y `etl_control.academic_period_closure` | Gestión, periodo y cierre autorizado | Contexto temporal y límite de disponibilidad | Excluir cortes no procesados, reabiertos o ambiguos conforme a reglas del DW y DSA |

## Campos observados en el hecho de retención

### Identidad y procedencia

- `estudiante_sk`, `programa_sk`, `periodo_academico_sk`, `closure_id`, `run_id`.
- El dataset preparado necesita un `student_ref` pseudonimizado y estable entre las versiones SCD2. No debe exponer `id_ra`, `id_alumno` ni `identity_key`.
- Conservar `programa_sk`, `closure_id`, gestión/periodo del calendario y `run_id` o referencias equivalentes para trazabilidad.

### Métricas candidatas

- `materias_cursadas`, `materias_aprobadas`, `materias_reprobadas`.
- `materias_arrastradas`, `ppa_acumulado`: nullable en el esquema; la preparación actual asigna `NULL`. No se consideran utilizables sin evidencia de cobertura.
- `resultado_retencion`, `es_desercion`, `conteo_evaluable` y `conteo_desercion` describen resultado/etiqueta observada. No deben entrar en predictors.

## Reglas de calidad derivadas del esquema

- La clave de snapshot es estudiante–programa–periodo; validar duplicados y correspondencia de `closure_id` con el periodo.
- `conteo_snapshot=1`, `conteo_evaluable` y `conteo_desercion` deben respetar las restricciones del DW.
- `NO_EVALUABLE` implica `es_desercion=NULL` y no debe transformarse en `false`.
- `RETENIDO` debe concordar con `es_desercion=false`; `DESERTOR`, con `true`.
- Las métricas de conteo no pueden ser negativas. Los nulos se reportan por campo y corte, no se imputan en esta fase.
- Comprobar que cortes usados sean cierres procesados y que la fecha efectiva y el `run_id` correspondan al snapshot.
- Resolver identidad estable a través de SCD2 antes de crear particiones por estudiante; impedir que versiones del mismo estudiante queden como sujetos distintos.
- Aceptar una feature únicamente si su definición y fecha de disponibilidad prueban que estaba disponible en el instante de predicción aprobado.

## Datos que no se han inspeccionado

El perfil de filas, cardinalidades, cobertura por periodo/programa, prevalencia, faltantes y exclusiones queda pendiente. Hay CSV/XLSX locales bajo `dss-uatf/dataset/data/out_oltp`; no se han abierto ni usado porque su autorización, anonimización y relación con el snapshot DW no están confirmadas. No se usan datos generados o fuentes OLTP como reemplazo de una extracción autorizada del DW.

