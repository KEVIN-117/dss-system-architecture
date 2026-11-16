# Objetivo: deserción a 4 años en carreras semestrales

| Campo | Valor |
|---|---|
| Referencia | `dsa:objetivo:2026-001:v1` |
| Tipo | `objetivo` |
| Estado | `APROBADA` |
| Respaldo DSA | Aprobación de DSA comunicada al equipo del proyecto el 2026-11-16, **sin documento escrito**. Conviene obtener una constancia escrita (acta, nota o correo) y citarla aquí antes del uso en producción. |
| Aprobada por | DSA, según lo informó el equipo del proyecto |
| Fecha de aprobación | 2026-11-16 |
| Reemplaza a | — |
| Reemplazada por | — |
| Alcance | Carreras de régimen semestral (`S`), cortes desde 2008-1 |

## Decisión

El modelo estima el riesgo de que un estudiante **abandone su carrera**. Abandonar significa no volver a cursar ninguna materia de esa carrera en los **4 años siguientes** al corte en que se hace la predicción.

## Definición operativa

- **Evento de riesgo:** deserción de la carrera a 4 años.
- **Clase positiva:** `RISK`. El estudiante no cursa ninguna materia de la carrera en ningún corte semestral de los 4 años siguientes al corte.
- **Clase negativa:** `NO_RISK`. El estudiante cursa al menos una materia de la carrera dentro de esos 4 años, aunque haya interrumpido.
- **Horizonte:** 4 años después del corte (`horizon_years: 4` en el manifiesto).
- **Instante de predicción:** el cierre del corte académico. Solo se usan datos disponibles en ese corte.
- **Fuente de la etiqueta en el DW:** `dw.fact_retencion_desercion.materias_cursadas` de los cortes siguientes de la misma carrera.
- **Casos sin resultado observable:** los cortes cuyos 4 años siguientes todavía no están en el DW se excluyen (`HORIZON_NOT_OBSERVED`). No se etiquetan como permanencia.
- **Opción del extractor:** `--dropout-horizon-years 4`, o `--horizonte 4` en `prediction-service/scripts/extraer_dataset_dw.sh`.
- **Identificador técnico:** el sistema registra este objetivo con `event_code` `PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE`. Ese código identifica la familia del evento y su contrato de variables, y es la clave con la que el servicio busca el modelo activo. Lo que distingue esta definición es `horizon_years: 4` junto con esta referencia.

## Fundamento

Entrenamiento exploratorio del 2026-11-16 con el DW completo (2008-1 a 2021-2, 97.160 casos, 13 % de deserción): ROC-AUC 0,88 y PR-AUC 0,53. Alertando al 20 % de mayor riesgo se detectan alrededor de 7 de cada 10 desertores. Los resultados están en `outputs/prediccion-exploratoria-2026-11-16`.

## Impacto

- **Modelos o datasets afectados:** los datasets de deserción extraídos con esta referencia y los modelos entrenados con ellos.
- **Qué hay que volver a extraer, entrenar o evaluar:** si cambia el horizonte, se crea `v2` y se vuelve a extraer, entrenar y evaluar.
