# DW-005 — Modelo dimensional de constelación de hechos

## Propósito y alcance

Este documento define el modelo lógico del primer Data Warehouse relacional de Jachasun: una constelación de hechos para admisión, cursado y retención/deserción. El DDL está en `0009` y las preparaciones de carga en migraciones posteriores; aquí se fijan significados, granos y agregaciones implementados por el MVP.

Este documento no ejecuta DDL ni cargas por sí mismo. DW-006 materializa las dimensiones y miembros técnicos en [conformed-dimensions.md](conformed-dimensions.md); la política SCD2 de estudiante se implementó en `0008`, `0014` y el flujo Hop. La issue #133 adopta y entrega Jachasun → Apache Hop → `dw`, sin dependencia del Load Manager en Go ni de su staging RAW. Se conserva el buffer privado `etl_work` del publisher atómico. DW-001 es la referencia de campos y filtros autorizados.

### Alcance consolidado del MVP

Se conservan únicamente `dw.fact_admision`, `dw.fact_cursado` y `dw.fact_retencion_desercion`. Su DDL está en `infra/dw-schema/migrations/0009_create_constellation_facts.sql`; `0008_add_student_scd2_versions.sql` proporciona la vigencia requerida para resolver la surrogate key temporal del estudiante. No se recrean las dimensiones de `0004` ni las entidades de control de `0001`–`0003`.

`fact_enrollment` queda para una ampliación futura. `fact_graduation` también queda fuera del DDL y las cargas del MVP: `actas_graduacion.graduados` es la fuente oficial identificada para una futura issue, que deberá fijar el grano, el evento de graduación y su correspondencia temporal. Ambas fuentes quedan fuera de los nueve contratos actuales. Esta decisión no cambia silenciosamente las reglas de egreso ni los denominadores de retención. Véase [la base consolidada](mvp-direct-hop.md).

## Principios de diseño

- Cada hecho responde a un proceso de negocio y tiene un grano propio. No existe una tabla de hechos única que mezcle admisiones, calificaciones y snapshots de permanencia.
- Las dimensiones conformadas permiten comparar procesos sin duplicar definiciones: estudiante, programa y periodo académico son comunes cuando el proceso dispone de ellas.
- Las claves sustitutas ya existen en las dimensiones de DW-006. Las claves naturales documentadas aquí conservan trazabilidad con Jachasun.
- `run_id` conserva el linaje técnico de una publicación y referencia el control de DW-004; no es una dimensión para filtros ni agregaciones analíticas.
- Los valores ausentes, desconocidos o no aplicables no se reemplazan por ceros. DW-006 define los miembros técnicos `UNKNOWN (-1)` y `NOT_APPLICABLE (0)` donde corresponda.
- El filtro de programas aprobado en DW-001 se aplica antes de publicar cualquiera de los hechos: programas activos y de tipo académico permitido. La implementación concreta reutilizará el contrato de `academico.alm_programas` y no inventará un segundo criterio.

## Dimensiones conformadas

| Dimensión lógica | Clave sustituta existente | Clave natural o identidad de negocio | Atributos y fuente principal | Hechos que la usan |
| --- | --- | --- | --- | --- |
| `DIM_ESTUDIANTE` | `estudiante_sk` | `id_alumno` es la identidad histórica canónica; `id_ra` es atributo de perfil y puede compartirse. | Atributos académicos de `academico.alumnos` y perfil de `public.uatf_datos` unido por `id_ra`; colegio y localidad son atributos del estudiante. | Admisión, cursado, retención/deserción |
| `DIM_PROGRAMA` | `programa_sk` | `id_programa` | Nombre, facultad, nivel, sede y atributos autorizados de `academico.alm_programas` y su relación de facultad. | Admisión, cursado, retención/deserción |
| `DIM_MATERIA` | `materia_sk` | `id_materia` | Sigla, nombre, plan, programa y atributos curriculares de `academico.pln_materias`. | Cursado |
| `DIM_PERIODO_ACADEMICO` | `periodo_academico_sk` | `(gestion, periodo)` | Gestión, código de periodo y metadatos del cierre DSA en `etl_control.academic_period_closure`. | Admisión, cursado, retención/deserción |
| `DIM_ADMISION` | `admision_sk` | `id_acceso` cuando esté informado | Modalidad o vía de acceso de `public.postulantes`; los valores no clasificados se resolverán con el miembro técnico adecuado. | Admisión |

### Identidad de estudiante

`DIM_ESTUDIANTE` mantiene una fila temporal por identidad académica `id_alumno`, identificador histórico confirmado por DSA/TI. `id_ra` enriquece la fila con el perfil de `public.uatf_datos`; no reemplaza la identidad canónica ni autoriza fusionar alumnos. En admisiones, `postulantes.id_alumno` identifica el registro de postulación, por lo que la identidad académica se obtiene enlazando `postulantes.id_ra` con `academico.alumnos.id_ra` y tomando el `academico.alumnos.id_alumno` correspondiente. El enlace debe resolver a cero o un alumno; más de una coincidencia se rechaza como ambigua. Los hechos de cursado y retención usan directamente el `id_alumno` académico y la versión SCD2 vigente al cierre.

Si faltan ambos identificadores o no es posible resolver la identidad, el hecho no se atribuye a una persona artificial ni se rellena con cero: el flujo usa el miembro `UNKNOWN` y registra la incidencia de calidad. Colegio y localidad no son dimensiones independientes en esta primera constelación, porque describen al estudiante y no habilitan un proceso de negocio con grano propio.

### Periodos y sucesión temporal

Para el seed sintético y el contrato temporal predictivo se usan los códigos OLTP de `academico.alm_periodos`: `1` y `2` son cierres semestrales consecutivos; `3` es el cierre anual de 12 meses. El sucesor esperado es `1→2` en la misma gestión, `2→1` en la gestión siguiente y `3→3` en la gestión siguiente. El código de periodo forma parte de `(gestion, periodo)` y permite resolver la cadencia sin inferirla de una ausencia de cursado.

La clave natural del periodo es siempre `(gestion, periodo)`. Para el contrato académico actual, los códigos de OLTP acreditados definen la cadencia: `1→2` para el semestre 1, `2→1` de la gestión siguiente para el semestre 2, y `3→3` de la gestión siguiente para el anual. La resolución se realiza por `(gestion, periodo)`, no por el siguiente cierre global ni por `periodo + 1`; así los cierres semestrales y anuales que comparten fecha no se confunden. La dimensión aún no transporta un atributo de cadencia del programa, por lo que la consistencia entre `id_programa` y su régimen debe validarse en la extracción/seed antes de usar estas etiquetas; si la fuente permite cambiar régimen, la cadencia debe historizarse como atributo de programa.

## Constelación de hechos

```mermaid
erDiagram
    DIM_ESTUDIANTE ||--o{ FACT_ADMISION : postula
    DIM_PROGRAMA ||--o{ FACT_ADMISION : recibe
    DIM_PERIODO_ACADEMICO ||--o{ FACT_ADMISION : ocurre_en
    DIM_ADMISION ||--o{ FACT_ADMISION : usa_modalidad

    DIM_ESTUDIANTE ||--o{ FACT_CURSADO : cursa
    DIM_PROGRAMA ||--o{ FACT_CURSADO : pertenece
    DIM_MATERIA ||--o{ FACT_CURSADO : evalua
    DIM_PERIODO_ACADEMICO ||--o{ FACT_CURSADO : ocurre_en

    DIM_ESTUDIANTE ||--o{ FACT_RETENCION_DESERCION : evalua
    DIM_PROGRAMA ||--o{ FACT_RETENCION_DESERCION : pertenece
    DIM_PERIODO_ACADEMICO ||--o{ FACT_RETENCION_DESERCION : snapshot_en

    DIM_ESTUDIANTE {
        bigint estudiante_sk PK
        string id_ra UK
        integer id_alumno_alterno
    }
    DIM_PROGRAMA {
        bigint programa_sk PK
        string id_programa UK
    }
    DIM_MATERIA {
        bigint materia_sk PK
        integer id_materia UK
    }
    DIM_PERIODO_ACADEMICO {
        bigint periodo_academico_sk PK
        smallint gestion
        smallint periodo
    }
    DIM_ADMISION {
        bigint admision_sk PK
        string id_acceso UK
    }
    FACT_ADMISION {
        bigint estudiante_sk FK
        bigint programa_sk FK
        bigint periodo_academico_sk FK
        bigint admision_sk FK
        integer id_alumno_origen
        uuid run_id
    }
    FACT_CURSADO {
        bigint estudiante_sk FK
        bigint programa_sk FK
        bigint materia_sk FK
        bigint periodo_academico_sk FK
        integer id_matricula_origen UK
        smallint grupo_degenerado
        uuid run_id
    }
    FACT_RETENCION_DESERCION {
        bigint estudiante_sk FK
        bigint programa_sk FK
        bigint periodo_academico_sk FK
        uuid run_id
    }
```

### Interpretación del diagrama

Las líneas del diagrama representan relaciones uno-a-muchos desde una dimensión hacia su hecho: un estudiante, programa o periodo puede aparecer en muchas filas, pero cada fila publicada conserva una sola referencia a cada dimensión aplicable. Estudiante, programa y periodo son conformadas, por lo que permiten analizar los tres procesos con filtros consistentes. Materia solo participa en cursado porque una postulación o un snapshot de retención no tienen el mismo grano curricular; modalidad de admisión solo participa en admisión por la misma razón.

`FACT_ADMISION` describe una postulación, `FACT_CURSADO` un intento de cursado y `FACT_RETENCION_DESERCION` el estado de permanencia de un estudiante en un corte. Comparten dimensiones sin que sus medidas puedan sumarse entre sí. Por ejemplo, un puntaje de examen no es una nota final, y una fila de retención no es una matrícula. El `run_id` dibujado en los hechos preserva qué ejecución de DW-004 publicó una fila; se usa para auditoría y reproceso, no para segmentar indicadores de negocio.

## Diccionario de hechos

### `FACT_ADMISION`

| Elemento | Definición |
| --- | --- |
| Proceso | Postulación y resultado de admisión a un programa. |
| Grano | Una fila por registro operativo de `public.postulantes`, identificado por `postulantes.id_alumno`, asociado al programa y periodo informados. |
| Identidad académica | Enlace por `id_ra` a `academico.alumnos`; cuando existe exactamente una coincidencia, se resuelve `estudiante_sk` usando el `id_alumno` académico. Sin coincidencia, se conserva `UNKNOWN`; una coincidencia múltiple bloquea la preparación. |
| Clave operacional de trazabilidad | `postulantes.id_alumno` permanece en `id_alumno_origen`; se conserva además `id_programa`, `id_gestion` e `id_periodo` para conciliación. |
| Claves dimensionales | `estudiante_sk`, `programa_sk`, `periodo_academico_sk`, `admision_sk`. |
| Fuente y dependencias | Contrato 03 de DW-001 (`public.postulantes`), `DIM_ESTUDIANTE`, `DIM_PROGRAMA`, `DIM_PERIODO_ACADEMICO`, `DIM_ADMISION` y filtro de programas aprobado. |
| Linaje técnico | `run_id` de la ejecución publicada y versión del contrato/manifiesto de origen. |
| Restricción de agregación | No se une con calificaciones para producir un indicador a nivel de fila. Los embudos se calculan exclusivamente sobre este hecho. |

| Medida o flag | Origen o derivación posterior | Tipo de aditividad | Agregación válida |
| --- | --- | --- | --- |
| `conteo_postulacion` | Constante `1` por fila de hecho. | Aditiva en sus dimensiones. | `SUM`; para personas únicas, `COUNT DISTINCT` de una identidad aprobada. |
| `conteo_admitido` | Derivado de `estado` solo después de aprobar su dominio funcional. | Aditiva si el flag es evaluable. | `SUM`; tasa de admisión = `SUM(conteo_admitido) / SUM(conteo_postulacion)` sobre el mismo filtro. |
| `puntaje_examen` | `postulantes.nota`. | No aditiva. | `AVG`, mínimo, máximo o percentiles; nunca `SUM`. |

La regla funcional comunicada por DSA interpreta `postulantes.estado = 'A'` como aprobado y `'P'` como reprobado. Otros valores se conservan como desconocidos/incidencia de calidad; no se convierten silenciosamente a admisión o rechazo.

### `FACT_CURSADO`

| Elemento | Definición |
| --- | --- |
| Proceso | Intento de cursado y registro de calificación por materia. |
| Grano | Una fila por `academico.notas_planilla.id_matricula`. |
| Clave operacional de trazabilidad | `notas_planilla.id_matricula`; `grupo` se conserva como dimensión degenerada, porque identifica el paralelo dentro de la fila pero no requiere dimensión propia. |
| Claves dimensionales | `estudiante_sk`, `programa_sk`, `materia_sk`, `periodo_academico_sk`. |
| Fuente y dependencias | Contrato 06 de DW-001 (`academico.notas_planilla`), contratos de alumnos, programas y materias, y el filtro de programas aprobado. |
| Linaje técnico | `run_id`, versión del contrato y manifiesto de snapshot. |
| Restricción de agregación | Las tasas de desempeño se calculan con intentos de cursado; no se mezclan con postulación ni con snapshots de retención. |

| Medida o flag | Origen o derivación posterior | Tipo de aditividad | Agregación válida |
| --- | --- | --- | --- |
| `conteo_intento` | Constante `1` por `id_matricula`. | Aditiva. | `SUM`. |
| `nota_final`, `nota_complementaria`, `nota_examen_mesa` | `nota`, `nota_2da`, `nota_ex_mesa`, respectivamente. | No aditiva. | `AVG`, mínimo, máximo o percentiles, ignorando valores no evaluables. |
| `nota_parcial_1` a `nota_parcial_4` | `pparcial`, `sparcial`, `tparcial`, `cparcial`. | No aditiva. | `AVG` y distribución; nunca `SUM`. |
| `conteo_aprobado`, `conteo_reprobado` | Derivados de la mejor nota final/complementaria cuando la fila es evaluable. | Aditiva por fila evaluable. | `SUM`; las tasas usan el denominador explícito de intentos o evaluables. |
| `conteo_repeticion` | Derivado posterior de la secuencia de intentos de un estudiante en la misma materia, sin crear una métrica inventada cuando falte historia. | Aditiva por intento clasificado. | `SUM`; análisis de repetición por estudiante requiere identidad reconciliada. |

El MVP conserva el estado fuente y determina aprobación/reprobación con la mejor nota (`GREATEST(nota, nota_2da)`) cuando es evaluable. El abandono se calcula en `FACT_RETENCION_DESERCION` según la regla de parciales y el cierre siguiente; no se infiere como una propiedad aislada de una nota/materia. Códigos sin semántica confirmada no se reclasifican.

### `FACT_RETENCION_DESERCION`

| Elemento | Definición |
| --- | --- |
| Proceso | Evaluación de permanencia para un estudiante y programa al cierre de un periodo académico. |
| Grano | Un snapshot por estudiante, programa y periodo académico cerrado por DSA. |
| Clave operacional de trazabilidad | Composición derivada de la identidad de estudiante, `id_programa` y `(gestion, periodo)`, junto con el cierre DSA y la ejecución que lo publicó. No sustituye las claves de `FACT_CURSADO`. |
| Claves dimensionales | `estudiante_sk`, `programa_sk`, `periodo_academico_sk`. |
| Fuente y dependencias | Derivación posterior a partir de cursado publicado, dimensiones conformadas y el calendario `etl_control.academic_period_closure`; no existe una extracción OLTP independiente para este hecho. |
| Linaje técnico | `run_id`, cierre origen y manifiestos de cursado utilizados. |
| Restricción de agregación | Representa estados en el tiempo. No se suman snapshots de periodos distintos como si fueran estudiantes únicos. |

| Medida, flag o resultado | Origen o derivación posterior | Tipo de aditividad | Agregación válida |
| --- | --- | --- | --- |
| `conteo_snapshot` | Constante `1` por estudiante-programa-periodo. | Semiaditiva en el tiempo. | `SUM` dentro de un periodo; en varios periodos representa estudiante-periodos, no estudiantes únicos. |
| `materias_cursadas`, `materias_aprobadas`, `materias_reprobadas`, `materias_arrastradas` | Derivación de `FACT_CURSADO` y reglas curriculares validadas. | Semiaditivas en el tiempo. | `SUM` para una cohorte y corte determinados; no sumar entre cortes para describir estado actual. |
| `ppa_acumulado` | Derivación posterior con la regla institucional aprobada. | No aditiva. | `AVG` sobre snapshots comparables; nunca `SUM`. |
| `resultado_retencion` | Clasificación derivada: `RETENIDO`, `DESERTOR` o `NO_EVALUABLE`; puede incluir un estado de egreso no evaluable mientras se valida su fuente. | No aditiva. | Filtrar o contar por categoría; no sumar ni reemplazar por cero. |
| `conteo_evaluable` | `1` solo para resultados de retención válidos para tasa. | Aditiva sobre registros evaluables. | `SUM`; denominador de las tasas. |
| `conteo_desercion` | `1` únicamente si el resultado es deserción evaluable. | Aditiva sobre registros evaluables. | `SUM`; tasa = `SUM(conteo_desercion) / SUM(conteo_evaluable)`. |
| `es_desercion` | `true` o `false` solo cuando es evaluable; `NULL` si no lo es. | No aditiva como atributo booleano. | Contar o promediar únicamente sobre el conjunto evaluable. |

#### Política de `NO_EVALUABLE` y egreso

DSA confirmó esta regla, implementada en el MVP: con un siguiente cierre procesado, cursado del estudiante en ese cierre significa `RETENIDO`; si no hay cursado allí y se rindieron menos de dos parciales en el periodo evaluado, se clasifica como `DESERTOR`. Si el cierre siguiente aún no está procesado, fue reabierto o su orden temporal es ambiguo, el snapshot se clasifica como `NO_EVALUABLE`, `es_desercion = NULL` y `conteo_evaluable = 0`; no participa en tasas ni entrenamiento.

Los casos con indicio de egreso conocido quedan fuera del denominador; no se usa `fec_egreso` como sustituto de un evento oficial de graduación. La fuente futura identificada para graduación es `actas_graduacion.graduados`, fuera de los nueve contratos actuales. La población observable del MVP requiere una fila de `notas_planilla` para el periodo: no se crean snapshots para estudiantes sin fila porque los contratos actuales no aportan un padrón histórico por periodo. Son límites funcionales conocidos del alcance, no defectos pendientes del MVP.

## Mapa de KPI a hechos

| Necesidad de Features e informe técnico | Hecho propietario | Dimensiones de análisis | Regla de agregación o límite |
| --- | --- | --- | --- |
| Demanda y volumen de postulaciones | `FACT_ADMISION` | Programa, periodo, modalidad, estudiante | `SUM(conteo_postulacion)`. |
| Admisiones y tasa de admisión | `FACT_ADMISION` | Programa, periodo, modalidad | Numerador y denominador del mismo hecho; `A` = aprobado y `P` = reprobado según definición funcional recibida. |
| Puntaje de ingreso | `FACT_ADMISION` | Programa, periodo, modalidad | `AVG(puntaje_examen)`, no suma. |
| Aprobación, reprobación y abandono por materia | `FACT_CURSADO` | Programa, materia, periodo, grupo | Suma de flags y tasas sobre intentos/evaluables del mismo hecho. |
| Rendimiento en notas finales o complementarias | `FACT_CURSADO` | Programa, materia, periodo, estudiante | Promedios y distribuciones de notas; no se combina con examen de admisión. |
| Materias arrastradas y PPA | `FACT_RETENCION_DESERCION` | Programa, periodo, estudiante | Snapshot de un corte; medidas semiaditivas o no aditivas según la tabla. |
| Retención, deserción, cohortes y permanencia | `FACT_RETENCION_DESERCION` | Programa, periodo, estudiante | Solo registros evaluables; `NO_EVALUABLE` y egreso no validado quedan fuera. |
| Señales para riesgo académico/ML | `FACT_RETENCION_DESERCION` y hechos previos con corte temporal | Programa, periodo, estudiante | La preparación para ML debe respetar el corte y no usar información futura; no es una carga DW-005. |

Cada KPI tiene un único hecho propietario. Los tableros que comparen procesos pueden colocar métricas separadas en el mismo panel, pero no unir filas de hechos incompatibles para sumar o promediar valores.

## Decisiones y trazabilidad de implementación

| Decisión | Aplicación | Seguimiento |
| --- | --- | --- |
| Identidad académica histórica | `id_alumno` canónico; `id_ra` enriquece el perfil y no es único. | SCD2 y resolución por `id_alumno`; `UNKNOWN` se usa conforme a `0017`–`0018`. |
| Filtro de programas único | Todos los hechos heredan el filtro definido en los contratos DW-001. | Aplicado en extracción/preparación del MVP. |
| Unknown y No aplica | Se usarán únicamente como miembros técnicos explícitos; no ceros sustitutos. | Miembros físicos en DW-006. |
| Periodo posterior DSA | Retención sigue cierres autorizados, no aritmética sobre `periodo`. | Implementado y probado con cierres de fixture. |
| `NO_EVALUABLE` | Sin siguiente cierre procesado: `es_desercion = NULL`, fuera de tasa y entrenamiento. | Implementado y cubierto por las pruebas de retención. |
| Egreso | No inferir graduación desde `fec_egreso`; casos con indicio conocido no entran al denominador del MVP. | `actas_graduacion.graduados` queda como extensión futura con contrato propio. |
| Linaje | `run_id` en hechos para auditoría, sin dimensión analítica de ejecución. | FKs, workflow y publisher atómico implementados. |
| Sin métricas inventadas | Datos ausentes mantienen nulabilidad o estado de calidad; no se fabrican notas, estados ni conteos. | Regla aplicada en las transformaciones y pruebas de integración. |

## Estado de decisiones y límites conocidos

Las decisiones funcionales principales se incorporaron al MVP y la integración fue probada con fixtures. La siguiente tabla documenta el estado de las decisiones, no bloquea el cierre de la issue #133:

| Validación | Responsable principal | Evidencia requerida |
| --- | --- | --- |
| `public.postulantes` y grano de admisión | El contrato usa explícitamente la fuente pública y el grano implementado por `id_alumno`; el DDL y la extracción se prueban con fixture. |
| Estado de admisión | DSA comunicó `A` = aprobado y `P` = reprobado; otros valores no se fuerzan a esos estados. |
| Retención/deserción | DSA confirmó continuidad por cursado en el siguiente cierre y abandono con menos de dos parciales; implementado con `NO_EVALUABLE` cuando no existe cierre posterior procesado. |
| Orden de periodos | Lo determina `academic_period_closure.effective_at`, no `periodo + 1`; integrado con el control de cierres. |
| Esquema y tipos | Contratos y fixtures se alinean con el DDL versionado; antes de producción se confirma el catálogo y los grants del endpoint objetivo. |

Las dimensiones, vigencias SCD2, tres hechos y carga Hop están implementados. La integración sintética valida el comportamiento del MVP; una ejecución real sigue su propio proceso de despliegue y autorización, y no se presenta como evidencia ya completada.
