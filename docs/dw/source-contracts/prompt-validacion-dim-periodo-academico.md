# Prompt: validación definitiva de `DIM_PERIODO_ACADEMICO`

Prompt independiente para investigar el calendario académico de Jachasun antes de cerrar la dimensión temporal académica del DW.

---

## Prompt reutilizable

Actúa como especialista en Data Engineering y modelado dimensional para el DW académico de la UATF. Valida con evidencia de catálogo y consultas de solo lectura si es correcto construir un catálogo histórico de períodos académicos usando como fuente candidata `academico.dct_asignaciones`.

La hipótesis funcional inicial es:

```sql
SELECT DISTINCT id_programa, id_gestion, id_periodo
FROM academico.dct_asignaciones;
```

La consulta se plantea porque `id_gestion` e `id_periodo` aparecen en las tablas operacionales como identificadores del corte al que pertenece el registro y se espera que `dct_asignaciones` ayude a reconstruir períodos desde los inicios de la universidad. **No des por probada esa cobertura ni que esos códigos basten para definir una dimensión definitiva.** Verifícalo contra Jachasun y otras fuentes de períodos.

### Contexto del modelo

- El modelo DW vigente define `dw.dim_periodo_academico` con clave natural `(gestion, periodo)` y surrogate key `periodo_academico_sk`, compartida por admisión, cursado y retención. Revisa `docs/dw/conformed-dimensions.md`, `docs/dw/dimensional-model.md` y `docs/dw/academic-closure-calendar.md`.
- `id_programa` pertenece a la dimensión de programa; en la propuesta actual se usa para validar qué programas tuvieron actividad en cada corte, **no** como parte de la clave natural de `DIM_PERIODO_ACADEMICO`, a menos que los datos demuestren que el mismo `(id_gestion, id_periodo)` tiene semánticas temporales incompatibles entre programas. Si ocurre, documenta el conflicto y recomienda alternativas; no alteres el modelo automáticamente.
- Distingue una dimensión de período académico de una dimensión calendario (`DIM_FECHA`). Este análisis valida el corte académico que comparten los hechos; no inventa fechas diarias.
- `etl_control.academic_period_closure` es la autoridad del DW para autorización y fecha efectiva de cierres futuros. Los catálogos OLTP sirven como evidencia de historia, no autorizan cargas.

### Seguridad y ejecución

1. Usa exclusivamente la cuenta aprobada de solo lectura y confirma la base, usuario y versión real de PostgreSQL. El respaldo local del DDL indica una versión antigua; verifica compatibilidad antes de ejecutar SQL.
2. No incluyas credenciales, host, cadenas de conexión ni secretos en archivos, logs, reportes o mensajes.
3. Ejecuta únicamente consultas de catálogo y `SELECT`, en transacción `READ ONLY`, con `statement_timeout`/`lock_timeout` conservadores.
4. Los escaneos históricos potencialmente costosos requieren autorización de TI/DBA y horario de baja actividad. No uses `EXPLAIN ANALYZE` contra producción sin aprobación explícita.
5. No muestres ni exportes datos personales. Para este análisis, códigos de programa y códigos de período se permiten; evita nombres de personas, identificadores estudiantiles y datos libres.
6. No ejecutes DDL, DML, migraciones, cambios de permisos ni cargas ETL. El resultado es una recomendación documentada, no una implementación.

### Preguntas que debe resolver el análisis

1. **Existencia y estructura:** ¿está presente `academico.dct_asignaciones` en la instancia real? ¿Qué tipos, nulabilidad, restricciones e índices tienen `id_programa`, `id_gestion` e `id_periodo`? ¿Coinciden con el DDL local?
2. **Cobertura temporal:** ¿cuál es la primera y última gestión detectada? ¿Qué pares distintos `(id_gestion,id_periodo)` hay? ¿Hay lagunas? ¿Los resultados cubren el rango histórico esperado desde la creación de la universidad o solo desde que la tabla empezó a registrar asignaciones?
3. **Cobertura por programa:** ¿qué programas aparecen por corte? ¿Hay programas con períodos académicos que no tienen filas en `dct_asignaciones`? No confundas ausencia de asignaciones docentes con inexistencia de un período académico.
4. **Contraste entre fuentes:** compara los pares gestión/período presentes en `dct_asignaciones` con las fuentes reales relevantes, al menos `academico.notas_planilla`, `public.postulantes`, tablas OLTP de matrícula/programación disponibles y cualquier catálogo oficial de períodos que exista. Reporta intersecciones y pares faltantes por fuente, agregados y sin exponer alumnos.
5. **Semántica de los códigos:** determina con datos y comentarios si `id_periodo` significa lo mismo para todos los programas; identifica códigos distintos de los semestres regulares, anualizados, intensivos/verano/invierno y cambios históricos. No asumas que 1 y 2 son los únicos valores ni que códigos iguales implican duración idéntica.
6. **Orden temporal:** establece si existe una secuencia cronológica oficial entre períodos. No uses `periodo + 1` ni orden alfabético/numérico como sucesión temporal sin evidencia. Identifica la fuente oficial para ordenar cortes y los casos ambiguos que requieran DSA.
7. **Fechas:** busca fechas oficiales de inicio, cierre y vigencia. Distingue fechas de asignación, registro o carga de una fecha académica efectiva. No derives límites de semestre de promedios o fechas de actividad sin aprobación.
8. **Grano y clave DW:** confirma si `(gestion, periodo)` identifica unívocamente un corte académico común. Evalúa si `id_programa` debe permanecer fuera de la clave, como indica el modelo vigente, o si las diferencias semánticas requieren un atributo/relación adicional. Recomienda sin cambiar DDL.
9. **Miembros técnicos:** considera cómo se asignarán `UNKNOWN` y `NOT_APPLICABLE` de acuerdo con la convención de `dw.dim_periodo_academico`; no inventes cortes ni sustituyas códigos faltantes por cero.
10. **Reconciliación:** ofrece conteos para comparar cada fuente con el catálogo candidato y reglas reproducibles para marcar pares desconocidos, inconsistentes o fuera de rango.

### Consultas esperadas

Primero inspecciona catálogo, comentarios, restricciones e índices reales. Luego prepara consultas de solo lectura para:

- catálogo distinto por `id_programa`, `id_gestion`, `id_periodo`;
- pares distintos `(id_gestion,id_periodo)` y conteo de programas por par;
- cobertura mínima/máxima por año y distribución de códigos de período;
- periodos por fuente y diferencias de cobertura entre fuentes;
- detección de gestiones/períodos faltantes respecto de una secuencia **solo si** DSA confirma cuál es la secuencia esperada;
- comparación de códigos dentro de una misma gestión entre programas, buscando posibles significados diferentes;
- resumen de fechas oficiales disponibles y discrepancias entre fechas y `id_gestion`.

Usa `DISTINCT` correctamente. No ejecutes el ejemplo de hipótesis antes de verificar que la tabla/columnas existen y que el costo está autorizado. Evita consultas de detalle por estudiante.

### Guardado obligatorio de artefactos

Guarda todo el trabajo local en:

```text
analysis-output/jachasun/time-dimension/
```

Esta ruta está ignorada por Git. Debes guardar:

- `report.md`: resultados, conclusión sobre cobertura y grano, limitaciones y decisiones pendientes.
- `sql/`: cada consulta exacta ejecutada, numerada y comentada.
- `csv/`: **un CSV UTF-8 con encabezados por cada consulta ejecutada**. Usar nombres estables, por ejemplo `Q01_source_columns.csv` y `Q05_periods_by_source.csv`. Los CSV deben contener únicamente metadatos o resultados agregados aprobados, nunca filas personales.
- `manifest.csv`: ID de consulta, archivo SQL, archivo CSV, estado (`SUCCESS`, `TIMEOUT`, `ERROR`, `NOT_RUN`), filas exportadas, duración, fecha/hora y motivo de error/omisión. No guardar host, usuario ni secretos.
- `environment.txt`: base lógica, versión PostgreSQL, fecha/hora, confirmación `READ ONLY` y hashes/versiones de DDL y documentos revisados; sin credenciales ni dirección de conexión.

No crees dumps ni exportaciones sin agregar. No hagas commit ni push de esa carpeta, no copies CSV a directorios versionados y no reemplaces evidencia fallida por archivos inventados.

### Entrega

Presenta:

1. Un dictamen: `validada`, `validada con condiciones` o `no validada`.
2. Evidencia CSV asociada a cada conclusión.
3. Propuesta concreta de atributos de `DIM_PERIODO_ACADEMICO`, distinguiendo atributos demostrados de los que requieren fuente oficial.
4. Recomendación sobre la clave natural y el uso de `id_programa`.
5. Riesgos de cobertura histórica y límites de `dct_asignaciones`.
6. Preguntas puntuales para DSA/TI antes de declarar la dimensión definitiva.

Separa hechos observados, inferencias y decisiones funcionales pendientes. No declares la dimensión definitiva únicamente porque la consulta `SELECT DISTINCT` termine correctamente.

---

## Referencias locales

- DDL OLTP: `infra/postgres-tx/ddl/ddl_jachasun.sql`.
- Dimensiones conformadas: `docs/dw/conformed-dimensions.md`.
- Modelo dimensional: `docs/dw/dimensional-model.md`.
- Calendario de cierres: `docs/dw/academic-closure-calendar.md`.
