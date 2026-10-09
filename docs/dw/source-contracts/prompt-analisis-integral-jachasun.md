# Prompt: análisis integral de Jachasun para el DW

Usa el siguiente prompt cuando se vaya a ejecutar el análisis contra la instancia OLTP autorizada.

---

## Prompt reutilizable

Actúa como arquitecto de datos y especialista en Data Warehouse académico. Analiza la base OLTP Jachasun para validar las fuentes, el grano, las reglas de negocio y la calidad de los datos necesarios para el MVP del DW de la UATF.

### Contexto y fuentes

- Usa como referencia inicial el DDL local `infra/postgres-tx/ddl/ddl_jachasun.sql` y los contratos en `docs/dw/source-contracts/`. Trátalos como hipótesis que deben verificarse contra el catálogo y los datos reales; no asumas que el respaldo local coincide con producción.
- Fuentes del DW: `public.uatf_datos`, `academico.alumnos`, `public.postulantes`, `academico.alm_programas`, `academico.pln_materias`, `academico.notas_planilla`, `academico.alm_programas_facultades`, `public.prs_colegios` y `public.lugar_localidad`.
- Incluir también la fuente oficial de graduación `actas_graduacion.graduados`. Analizarla para decidir si sustenta `FACT_GRADUATION`, sin asumir de antemano su grano, clave, semántica ni que esté completa.
- El rango histórico de interés es 2000–2025. Para reglas de notas y cursado, considerar especialmente los filtros funcionales ya propuestos por DSA, y reportar por separado cualquier población excluida.
- El MVP conserva `FACT_ADMISION` y `FACT_CURSADO`; `FACT_RETENCION_DESERCION` requiere definición validada. La graduación se analiza ahora como fuente candidata y se recomienda su inclusión o exclusión con evidencia.

### Seguridad y límites obligatorios

1. Conectarse únicamente con una cuenta OLTP confirmada como solo lectura. No usar ni solicitar credenciales administrativas.
2. No incluir contraseñas, tokens, cadenas de conexión ni secretos en scripts, logs, reportes o mensajes. Leer credenciales solo desde el mecanismo local seguro aprobado; no repetir credenciales expuestas anteriormente.
3. Verificar el usuario, la base, la versión de PostgreSQL y que la transacción sea `READ ONLY` antes de consultar datos.
4. Ejecutar exclusivamente `SELECT` y lecturas de catálogos. No ejecutar DDL, DML, funciones con efectos secundarios, escrituras, cambios de permisos ni migraciones.
5. Aplicar `statement_timeout` y `lock_timeout` conservadores. Ejecutar consultas de escaneo completo únicamente con autorización de TI/DBA y fuera de horario operativo. Si una consulta excede el límite, detenerse, guardar el error y pedir evaluación de TI/DBA; no reintentar repetidamente.
6. No exportar PII ni filas a nivel de estudiante. Los resultados deben ser agregados. Nunca exportar nombres, `id_ra`, `id_alumno`, documentos, teléfonos, correos, direcciones, usuarios, claves ni observaciones libres.
7. No modificar datos ni configuración de Jachasun. No iniciar cargas ETL como parte de este análisis.

### Análisis requeridos

1. **Estructura y contratos:** comparar existencia, esquema, tipos, longitudes, nulabilidad, comentarios, claves, índices y restricciones de las fuentes con el DDL y contratos. Identificar diferencias entre ambientes y entre tablas homónimas.
2. **Cursado y grano de `FACT_CURSADO`:** validar unicidad de `notas_planilla.id_matricula`; medir grupos repetidos por alumno, materia, gestión, período y grupo; distinguir repetición legítima/reintento de duplicidad técnica. Revisar nulos, claves huérfanas, valores fuera de rango y cómo se representa la rectificación de una nota.
3. **Semántica de calificaciones:** contrastar `nota`, `nota_2da`, `nota_ex_mesa`, parciales y `observacion`/`estado`. Evaluar la regla propuesta (`GREATEST(nota, nota_2da) > 50` aprobado; entre 1 y 50 reprobado; cero como señal por investigar), códigos de homologación, compensación, convalidación y dictamen, y valores no reconocidos. No convertir automáticamente cero, nulo o desconocido en abandono, aprobado o reprobado.
4. **Abandono y retención:** comprobar qué puede inferirse de parciales con valor no cero y porcentaje de materias aprobadas al cierre. Mostrar denominadores y filtros usados. Explicar si el OLTP permite distinguir ausencia real de un cero por defecto y si hay datos para clasificar continuidad al siguiente período cerrado. No establecer una regla definitiva sin evidencia y aprobación funcional de DSA.
5. **Tiempo académico:** analizar `id_gestion`, `id_periodo`, los catálogos de períodos y los cierres disponibles; detectar códigos, lagunas y carreras anualizadas/semestralizadas. No inferir el período siguiente mediante aritmética. Indicar cómo ordenar períodos con base en información real.
6. **Admisión:** evaluar distribución y semántica observada de `postulantes.estado` y `estado_postulacion`; probar claves candidatas y repeticiones por `id_alumno`, `id_ra`, programa y corte. No asumir que `postulantes.id_alumno` es el mismo identificador que `academico.alumnos.id_alumno`. Medir cobertura de cruces mediante las claves justificadas por el DDL.
7. **Matrícula:** determinar si las fuentes disponibles representan matrícula efectiva, incluyendo estudiantes sin notas. Revisar disponibilidad y semántica de tablas de matrícula/programación pertinentes; recomendar si existe evidencia suficiente para indicadores de matriculados o si debe quedar fuera del MVP.
8. **Identidad e historia del estudiante:** validar unicidad/cobertura de `public.uatf_datos.id_ra`, el enlace con alumnos y qué atributos tienen historia verificable. No tratar el estado actual de `alumnos` o `uatf_datos` como si describiera todo el pasado.
9. **Catálogos históricos:** validar relaciones entre programas y facultades, materias y planes; estimar si el catálogo actual representa correctamente años antiguos y si hay evidencia de cambios de programa, facultad, plan o materia. Identificar los riesgos para SCD2.
10. **Graduación (`actas_graduacion.graduados`):** inspeccionar primero columnas, tipos, nulabilidad, comentarios, claves e índices reales. Después analizar, solo con agregados, distribución por fecha de graduación, `id_gestion`, programa y modalidad; nulos; discrepancia entre año de fecha y gestión; alumnos/programas sin correspondencia; claves candidatas y repeticiones. Determinar qué campo representa el evento oficial, si varias filas por alumno pueden ser títulos legítimos y qué fecha debe alimentar la dimensión temporal. No exponer identificadores ni títulos ligados a personas.
11. **Filtros y población:** cuantificar el efecto de las exclusiones aprobadas para programas y materias; separar nulos, códigos no mapeados y filas que no encuentran catálogo. Reportar conteos antes y después del filtro sin ocultar la población excluida.
12. **Rendimiento y operación:** revisar tamaños estimados, índices y planes `EXPLAIN` sin `ANALYZE` en horario operativo. Cualquier medición que ejecute una consulta costosa sobre producción requiere aprobación de TI/DBA. Reportar límites y duración real de cada consulta.

### Persistencia de todo el trabajo

Guarda los artefactos locales en `analysis-output/jachasun/`, ruta ignorada por Git:

- `report.md`: conclusiones, decisiones recomendadas, limitaciones y preguntas pendientes.
- `sql/`: copia exacta de cada consulta ejecutada, identificada por número y tema. Incluye el script base `docs/dw/source-contracts/analisis_jachasun_read_only.sql` y cualquier consulta adicional.
- `csv/`: **un CSV UTF-8 con encabezados por cada consulta ejecutada**, con nombre estable como `Q01_source_columns.csv`. Exporta solo los resultados agregados/no sensibles. Si una consulta falla o se cancela, registra el estado en el manifiesto y no fabriques un CSV de resultados.
- `manifest.csv`: por consulta, registrar identificador, archivo SQL, archivo CSV si existe, estado (`SUCCESS`, `TIMEOUT`, `ERROR`, `NOT_RUN`), filas exportadas, duración, fecha/hora de ejecución y motivo de omisión/error. No incluir host, usuario, credenciales ni datos personales.
- `environment.txt`: únicamente nombre lógico de la base, versión de PostgreSQL, fecha/hora, estado `READ ONLY` y versión/hash del DDL/contratos; nunca secretos ni direcciones de conexión.

No guardar resultados, logs, CSV ni dumps en carpetas versionadas. No hacer commit ni push de `analysis-output/jachasun/`. Si se necesita compartir evidencia, compartir solo reportes agregados revisados y aprobados por DSA/TI.

### Forma de la respuesta final

Entrega un resumen ejecutivo y una matriz con `tema`, `hallazgo`, `evidencia/CSV`, `impacto en el DW`, `decisión recomendada` y `pendiente de aprobación`. Separa claramente:

- hechos confirmados por catálogo/datos;
- inferencias estadísticas;
- reglas propuestas, todavía no aprobadas;
- preguntas que requieren respuesta de DSA/TI.

No declares una fuente o hecho listo para producción solo porque la consulta terminó correctamente. La aprobación funcional de DSA y la validación técnica de TI siguen siendo requisitos.

---

## Nota de ejecución

El script inicial está en `docs/dw/source-contracts/analisis_jachasun_read_only.sql`. Antes de ejecutar sus consultas, confirmar primero en la instancia real que existen las tablas/columnas; en particular, la fuente de graduación no debe asumirse idéntica al DDL local.
