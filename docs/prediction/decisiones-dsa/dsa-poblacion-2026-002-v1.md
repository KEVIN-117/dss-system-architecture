# Población: carreras semestrales, primeros tres años de trayectoria

| Campo | Valor |
|---|---|
| Referencia | `dsa:poblacion:2026-002:v1` |
| Tipo | `poblacion` |
| Estado | `APROBADA` |
| Respaldo DSA | Aprobación de DSA comunicada al equipo del proyecto el 2026-11-16, **sin documento escrito**. Conviene obtener una constancia escrita (acta, nota o correo) y citarla aquí antes del uso en producción. |
| Aprobada por | DSA, según lo informó el equipo del proyecto |
| Fecha de aprobación | 2026-11-16 |
| Reemplaza a | — |
| Reemplazada por | — |
| Alcance | Carreras de régimen semestral (`S`); las 40 carreras semestrales del DW |

## Decisión

El modelo se aplica a estudiantes de carreras semestrales durante sus **primeros tres años** en la carrera, que es la etapa donde se concentra la deserción y donde una intervención tiene más sentido.

## Definición operativa

- **Incluye:** cada combinación de estudiante, carrera y corte semestral (periodos 1 y 2) dentro de los primeros tres años desde el primer corte del estudiante en esa carrera.
- **Excluye**, con su código en el extractor:
  - `LEFT_CENSORED_START`: estudiantes cuya historia en la carrera empieza antes del inicio del DW (2008-1), porque no se conoce su trayectoria completa.
  - `OUTSIDE_WINDOW`: cortes posteriores a los primeros tres años de trayectoria.
  - `HORIZON_NOT_OBSERVED`: cortes cuyo horizonte de 4 años todavía no se observa (ver `dsa:objetivo:2026-001:v1`).
  - `NO_COURSEWORK_AT_CUT`: cortes en que el estudiante no cursa materias.
  - Carreras de régimen anual, que necesitan su propio modelo y su propia decisión.
- **Casos ambiguos:** cada carrera se trata por separado. Un estudiante que cambia de carrera aparece como una trayectoria nueva en la carrera de destino. Las readmisiones dentro del horizonte cuentan como permanencia.
- **Cobertura del dataset de referencia (2026-11-16):** 97.160 casos elegibles. Exclusiones: 52.041 por horizonte no observado, 89.335 por historia anterior a 2008 y 105.983 fuera de la ventana de tres años.

## Fundamento

Con esta población, el entrenamiento exploratorio del 2026-11-16 obtuvo resultados útiles (ver `dsa:objetivo:2026-001:v1`). Las carreras anuales tienen otra cadencia de cortes y quedan para una decisión aparte.

## Impacto

- **Modelos o datasets afectados:** los datasets de deserción semestral extraídos con esta referencia.
- **Qué hay que volver a extraer, entrenar o evaluar:** si cambia la ventana, la cadencia o las exclusiones, se crea `v2` y se vuelve a extraer, entrenar y evaluar.
