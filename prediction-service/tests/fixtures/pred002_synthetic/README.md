# Fixture sintético PRED-002

Este fixture imita la forma de una extracción de `dw.fact_retencion_desercion` con el contrato `prepared-dataset-v1`. Contiene ocho registros fabricados, un solo corte y `run_id` ficticio; no deriva de personas, filas OLTP/DW, prevalencias ni decisiones institucionales.

- `rows.jsonl`: registros en orden canónico por `student_ref`, con outcome DW, indicadores de conteo y métricas candidatas.
- `manifest.json`: corte, procedencia ficticia, esquema, cantidad y digest SHA-256. `eligibility_approved` y `target_approved` son `false`; la población se marca `UNRESOLVED` y no se declara predictor aprobado.

La prueba correspondiente debe validar estructura y conteos, y mantener el conjunto en `BLOCKED`. Este artefacto no es una extracción autorizada, no acredita la semántica del target, no valida la elegibilidad y no debe usarse para entrenar ni evaluar modelos.
