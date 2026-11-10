# Contrato de analítica académica para Director

## Alcance de esta ampliación

Las analíticas descriptivas se sirven desde los cubos OLAP `Academic Admission`, `Academic Performance` y `Academic Retention`. Las vistas `dw.vw_fact_*_olap` estabilizan el grano de cada hecho y publican conteos agregables para que las tasas se calculen sobre denominadores explícitos.

| Pregunta | Fuente / medidas | Estado de datos |
| --- | --- | --- |
| Postulantes, admitidos, variación anual y tasa por sexo | `fact_admision`; `Applicants`, `Admitted Applicants`, `Known Admission Outcomes` | Conteos de personas distintas con estudiante identificado; solicitudes se cuentan por fila del hecho. La tasa usa personas con resultado conocido como denominador. |
| Distribución por facultad/carrera | `dim_programa`; `Academic Program` | Disponible según el alcance académico del usuario. |
| Sede central y subsedes | `dim_programa.sede`; `Academic Campus` | Se publica el código institucional de sede. |
| Colegio de origen y tipo de colegio | `dim_estudiante`; `Applicant Profile` | Solo agregados; sujetos a supresión por k-anonimidad. |
| Modalidad de ingreso | `dim_admision.id_acceso`; `Admission Mode` | Se publica el código de origen. El modelo DW aún no guarda una descripción institucional en la dimensión. |
| Promedio, aprobaciones, reprobaciones, repeticiones y abandonos | `fact_cursado`; medidas de `Academic Performance` | Cubo y medidas agregadas publicados. |
| Retención y deserción observada | `fact_retencion_desercion`; `Academic Retention` | Solo snapshots de periodos cerrados y evaluables entran en las tasas. |

No existe actualmente un atributo de área de conocimiento en el contrato `dim_programa` ni en su ETL. Por ello, el cubo no inventa una clasificación derivada de facultades o carreras. Para cubrir esa dimensión se necesita aprobar y cargar un catálogo institucional con su relación carrera-área.

Las postulaciones que no pudieron vincularse con una persona identificada no incrementan las medidas de personas distintas; sí permanecen en `Applications`. Esto evita presentar registros repetidos o claves técnicas como si fueran personas únicas.

## RBAC y privacidad

- El portal requiere una sesión autenticada y el rol `DIRECTOR`; sus operaciones OLAP pasan exclusivamente por el BFF.
- El BFF resuelve `analytics:read` y el permiso de alcance (`analytics:career`, `analytics:faculty` o `analytics:global`) usando los roles verificados.
- El contexto académico procede de Auth Service. El cliente no puede proporcionar ni reemplazar la facultad o carrera autorizada.
- Cada consulta con alcance restringido falla cerrada si el cubo no publica la dimensión, jerarquía y nivel de autorización configurados.
- La medida interna `Attempt Count` cuenta personas distintas (no filas de hechos) y se añade solo en el servidor para aplicar k-anonimidad. No aparece en el esquema ni en los resultados públicos.
- Los reportes solo agregan resultados. No exponen identificadores o filas individuales de estudiantes.

## Analítica predictiva y de grafos

Los puntos siguientes no se modelan como medidas del cubo descriptivo:

| Pregunta | Servicio / dependencia pendiente |
| --- | --- |
| Riesgo individual de deserción y factores explicativos | Prediction Service: publicación del modelo, corte vigente, autorización por programa y atributos explicables permitidos. |
| Materias cuello de botella | Modelo de malla curricular y relaciones de prerrequisito; análisis de grafo además de tasas observadas. |
| Proyección de cupos por materia | Histórico de cursado más capacidad/oferta planificada y un modelo de demanda por periodo futuro. |

El BFF cuenta con una operación de lectura de publicaciones predictivas, pero esta página no presenta aún puntuaciones de riesgo ni explicaciones. Esas vistas deben conservar la autorización por contexto y distinguir claramente predicción de resultado observado.
