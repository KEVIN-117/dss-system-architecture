# PRED-002 — Plan de comprensión y validación del dataset académico

**Estado:** análisis del esquema DW completado; perfilado de filas y definición de población pendientes de insumos autorizados.
**Rama:** `feature/PRED-002`
**Issue:** [PRED-002](https://github.com/KEVIN-117/dss-system-architecture/issues/145)
**Fase CRISP-DM:** Comprensión de los datos; preparación inicial.

## Objetivo

Determinar si los snapshots académicos disponibles tienen identidad, contexto temporal, cobertura, etiqueta y calidad suficientes para construir un dataset predictivo reproducible. La tarea no entrena ni publica un modelo.

## Evidencia revisada

- `infra/dw-schema/migrations/0009_create_constellation_facts.sql` define `dw.fact_retencion_desercion` con grano único `(estudiante_sk, programa_sk, periodo_academico_sk)`, `closure_id`, métricas de cursado, `resultado_retencion`, `es_desercion`, conteos de snapshot/evaluabilidad y `run_id`.
- La dimensión de periodo se relaciona con `etl_control.academic_period_closure`, que registra gestión, periodo, estado, cierre efectivo y procesamiento. El contrato debe identificar un corte procesado y no solo un periodo nominal.
- `resultado_retencion` acepta `RETENIDO`, `DESERTOR` o `NO_EVALUABLE`. La consistencia del DW exige `es_desercion=NULL` y `conteo_evaluable=0` para `NO_EVALUABLE`; no es una clase negativa.
- La preparación de retención (migración 0016) consulta el siguiente cierre procesado y usa evidencia de cursado/egreso para clasificar. La fila fuente puede ser candidata a observación etiquetada para un horizonte posterior, pero esa semántica debe aprobarse para el caso ML.
- La dimensión estudiante mantiene versiones SCD2. `estudiante_sk` cambia entre versiones; no basta como identidad para agrupar al mismo estudiante entre cortes. `identity_key` usa identificadores naturales y no debe exportarse como identificador visible.
- La tabla de retención deja `materias_arrastradas` y `ppa_acumulado` nullable; la preparación vigente escribe ambos como `NULL`. No se tratarán como features disponibles hasta demostrar cobertura.
- No se encontró una regla de primer/segundo año en los contratos físicos examinados. `dim_materia.ciclo` y `nivel_academico` describen materias; no identifican por sí solos el año de trayectoria del estudiante.

## Decisiones que requieren aprobación DSA

1. Evento de riesgo, clase positiva/negativa y fuente de etiqueta.
2. Horizonte, instante de predicción y regla de asociación entre corte y siguiente cierre procesado.
3. Regla verificable para primer y segundo año, incluyendo transferencias, readmisiones y cambios de programa.
4. Reglas de elegibilidad, exclusión y tratamiento de población ambigua.
5. Variables disponibles en el corte y criterio de cobertura mínima para declarar viable el dataset.

La propuesta PRED-001 de usar deserción en el siguiente cierre es un borrador, no una aprobación. El contrato deja población y objetivo sin resolver mientras se reciben las decisiones.

## Contrato preparado propuesto

El esquema versionado está en [`contracts/prepared-dataset-v1.yaml`](contracts/prepared-dataset-v1.yaml). Mantiene separados:

- identidad pseudonimizada estable entre cortes;
- programa y corte/cierre DW;
- features candidatas con declaración explícita de disponibilidad temporal;
- resultado observado del DW, sin convertirlo automáticamente en target ML;
- estado de elegibilidad (`ELIGIBLE`, `OUT_OF_SCOPE`, `AMBIGUOUS`, `UNRESOLVED`);
- procedencia del snapshot, corte, esquema, exclusiones y digest.

## Plan de validación

1. Recibir extracción DW autorizada, anonimizada/pseudonimizada y su manifiesto, sin leer exports OLTP locales como sustituto.
2. Confirmar con DSA las definiciones anteriores y versionar referencias de aprobación.
3. Perfilar cobertura temporal/programa, distribución observada de resultados, faltantes, duplicados y consistencia con los conteos DW.
4. Validar elegibilidad y separar fuera de alcance/ambiguos; cuantificar exclusiones por causa.
5. Verificar que cada feature esté disponible a más tardar en el corte y que ninguna etiqueta/resultado futuro entre en predictors.
6. Emitir `READY_FOR_PREPARATION`, `BLOCKED` o `INSUFFICIENT_EVIDENCE`; no habilitar entrenamiento ni publicar un modelo mientras falle un gate.

## Estado de aceptación

| Criterio | Estado |
|---|---|
| Esquema DW, grano, corte y fuente observada documentados | Cubierto por revisión estática de migraciones; falta corroborar contra extracción real |
| Evento, horizonte y población aprobados | Pendiente de DSA |
| Snapshot versionado con origen, corte y esquema | Contrato propuesto; pendiente de extracción autorizada |
| Perfil de faltantes, duplicados, clases y exclusiones | Pendiente de extracción autorizada |
| Adaptador y validación estructural | Implementados; pendientes de ejecutar con extracción autorizada |
| Pruebas de elegibilidad y fuga temporal | Cubiertas con fixtures sintéticos; no sustituyen validación institucional |
| Viabilidad | No determinada hasta contar con reglas y datos autorizados |
