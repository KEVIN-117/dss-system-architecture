# <Título de la decisión>

| Campo | Valor |
|---|---|
| Referencia | `dsa:<tipo>:<AAAA>-<NNN>:v<versión>` |
| Tipo | `objetivo` · `poblacion` · `politica` · `evaluacion` |
| Estado | `PROPUESTA` · `APROBADA` · `REEMPLAZADA` · `RECHAZADA` |
| Respaldo DSA | <número de acta, resolución o ticket, con fecha> |
| Aprobada por | <cargo y unidad de DSA, sin datos personales que no hagan falta> |
| Fecha de aprobación | <AAAA-MM-DD> |
| Reemplaza a | <referencia anterior, o "—"> |
| Reemplazada por | <referencia posterior, o "—"> |
| Alcance | <cadencia (semestral, anual), carreras o facultades, gestiones> |

## Decisión

<Qué se aprobó, en términos que entienda una persona de la unidad académica.>

## Definición operativa

Completa solo la sección del tipo de decisión y borra las demás.

### Objetivo (`objetivo`)

- **Evento de riesgo:** <por ejemplo, "deserción a N años">
- **Clase positiva:** <valor de la etiqueta, por ejemplo `RISK`> = <condición exacta>
- **Clase negativa:** <valor de la etiqueta> = <condición exacta>
- **Horizonte:** <años o cortes que se observan después del corte>
- **Instante de predicción:** <cuándo se calcula el riesgo, por ejemplo al cierre del corte>
- **Fuente de la etiqueta en el DW:** <tablas y columnas>
- **Casos sin resultado observable:** <cómo se tratan, por ejemplo horizonte censurado>
- **Opción del extractor:** <por ejemplo, `--dropout-horizon-years N`>

### Población (`poblacion`)

- **Incluye:** <estudiantes, cortes y carreras>
- **Excluye:** <cada causa, con su código de exclusión si lo tiene>
- **Casos ambiguos:** <transferencias, readmisiones, cambios de carrera>
- **Cobertura mínima para declarar viable el dataset:** <criterio>

### Política de decisión (`politica`)

- **Regla de alerta:** <fracción de mayor riesgo, o umbral fijo>
- **Modelo y uso al que aplica:** <por ejemplo, "deserción semestral, para tutorías">
- **Métrica prioritaria y mínimo aceptable:** <por ejemplo, recall ≥ X con la política>
- **Revisión:** <cada cuánto se revisa y quién la revisa>

### Evaluación (`evaluacion`)

- **Candidato:** `model_id`, `version`, `artifact_digest`
- **Dataset:** `dataset_id` y `content_digest`
- **Decisión PRED-004:** `APTO` / `NO_APTO` / `EVIDENCIA_INSUFICIENTE`
- **Reporte:** <ruta del reporte de evaluación>

## Fundamento

<Por qué DSA eligió esta definición: datos, normas académicas, evidencia exploratoria revisada.>

## Impacto

- **Modelos o datasets afectados:** <referencias>
- **Qué hay que volver a extraer, entrenar o evaluar:** <lista>
