# Política de alerta: 20 % de mayor riesgo

| Campo | Valor |
|---|---|
| Referencia | `dsa:politica:2026-003:v1` |
| Tipo | `politica` |
| Estado | `APROBADA` |
| Respaldo DSA | Aprobación de DSA comunicada al equipo del proyecto el 2026-11-16, **sin documento escrito**. Conviene obtener una constancia escrita (acta, nota o correo) y citarla aquí antes del uso en producción. |
| Aprobada por | DSA, según lo informó el equipo del proyecto |
| Fecha de aprobación | 2026-11-16 |
| Reemplaza a | — |
| Reemplazada por | — |
| Alcance | Modelo de deserción a 4 años en carreras semestrales (`dsa:objetivo:2026-001:v1`, `dsa:poblacion:2026-002:v1`) |

## Decisión

Se alerta al **20 % de estudiantes con mayor riesgo** de cada corte. La cuota representa una capacidad fija de seguimiento, por ejemplo de tutorías.

## Definición operativa

- **Regla de alerta:** cuota de alertas (`alert_rate`) de 0,20. El umbral del modelo se fija en la validación para que alerte al 20 % de los casos.
- **Modelo y uso al que aplica:** deserción semestral a 4 años, como apoyo a tutorías y seguimiento académico. La alerta no es una decisión sobre el estudiante.
- **Configuración de entrenamiento:** `decision_policy` con `alert_rate: 0.2`, `approved: true` y `policy_ref: dsa:politica:2026-003:v1`. Está en el catálogo `infra/prediction-configurations/`.
- **Métrica prioritaria:** el recall con esta política, es decir, qué parte de los desertores queda entre las alertas. Referencia exploratoria: 0,65 en la prueba temporal y 0,72 en el top 20 %.
- **Revisión:** cada vez que se cargan cortes nuevos o cambia la capacidad de seguimiento. En la prueba exploratoria la cuota real quedó en 16,7 % porque el umbral se fija en la validación; si se mantiene esa diferencia, conviene recalibrarlo.

## Fundamento

Con el 13 % de deserción observado, una cuota del 20 % deja margen para cubrir la mayoría de los casos de riesgo, con precisión cercana al 50 % en el entrenamiento exploratorio.

## Impacto

- **Modelos o datasets afectados:** los modelos de deserción semestral entrenados con esta configuración.
- **Qué hay que volver a extraer, entrenar o evaluar:** si cambia la cuota, se crea `v2` y se vuelve a entrenar. El dataset no cambia.
