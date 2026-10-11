/*
  Diagnostico de solo lectura para validar fuentes/reglas del DW contra Jachasun,
  incluida la fuente oficial de graduacion actas_graduacion.graduados.

  Uso:
    1. Conectarse a la base jachasun con una cuenta de SOLO LECTURA.
  2. Ejecutar primero el bloque de seguridad y luego la consulta 1 de metadatos.
    3. Ejecutar las consultas por seccion y revisar sus tiempos.
    4. Ejecutar ROLLBACK al terminar.

  No devuelve nombres, documentos, telefonos, correos ni claves de estudiantes.
  Las consultas 4, 5 y 7 pueden leer bastantes filas: ejecutarlas fuera de horario
  operativo y con autorizacion de TI/DBA. El timeout cancela una consulta lenta.

  El SQL evita FILTER y otras construcciones recientes para mantener compatibilidad
  con PostgreSQL 9.3, version indicada por el respaldo local del DDL. La version
  real se reporta en la primera consulta.
*/

-- 0. Proteccion de sesion: transaccion de solo lectura y limites de espera.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';


-- 1. Confirmar base, usuario, version y modo de solo lectura.
SELECT
    current_database() AS database_name,
    current_user AS read_only_user,
    current_setting('server_version') AS postgres_version,
    current_setting('transaction_read_only') AS transaction_is_read_only;


-- 2. Inventario real de columnas de las nueve fuentes contratadas.
SELECT
    table_schema,
    table_name,
    ordinal_position,
    column_name,
    data_type,
    udt_name,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE (table_schema, table_name) IN (
    ('public', 'uatf_datos'),
    ('academico', 'alumnos'),
    ('public', 'postulantes'),
    ('academico', 'alm_programas'),
    ('academico', 'pln_materias'),
    ('academico', 'notas_planilla'),
    ('academico', 'alm_programas_facultades'),
    ('public', 'prs_colegios'),
    ('public', 'lugar_localidad'),
    ('actas_graduacion', 'graduados')
)
ORDER BY table_schema, table_name, ordinal_position;


-- 3. Comentarios del catalogo para las columnas que definen las reglas.
SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS declared_type,
    col_description(c.oid, a.attnum) AS column_comment
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
WHERE c.relkind = 'r'
  AND (n.nspname, c.relname) IN (
      ('public', 'postulantes'),
      ('academico', 'notas_planilla'),
      ('academico', 'alumnos'),
      ('academico', 'alm_programas'),
      ('academico', 'pln_materias'),
      ('actas_graduacion', 'graduados')
  )
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN (
      'estado', 'estado_postulacion', 'observacion', 'nota', 'nota_2da',
      'nota_ex_mesa', 'pparcial', 'sparcial', 'tparcial', 'cparcial',
      'id_alumno', 'id_ra', 'fec_egreso', 'id_programa', 'id_periodo', 'id_gestion',
      'id_modalidad', 'fecha_graduacion', 'nota_graduacion', 'nro_dip', '_estado'
  )
ORDER BY n.nspname, c.relname, a.attnum;


-- 4. Distribucion de notas por gestion/periodo y contraste entre estado,
--    observacion y la regla numerica informada por DSA.
--    CERO es una categoria candidata, no una etiqueta final de abandono.
SELECT
    id_gestion,
    id_periodo,
    estado,
    observacion,
    CASE
        WHEN nota IS NULL AND nota_2da IS NULL THEN 'SIN_NOTA'
        WHEN GREATEST(nota, nota_2da) > 50 THEN 'APROBADO_NUMERICO'
        WHEN GREATEST(nota, nota_2da) > 0
             AND GREATEST(nota, nota_2da) <= 50 THEN 'REPROBADO_NUMERICO'
        WHEN GREATEST(nota, nota_2da) = 0 THEN 'CERO'
        ELSE 'REVISAR_VALOR'
    END AS resultado_numerico,
    COUNT(*) AS filas
FROM academico.notas_planilla
WHERE id_gestion BETWEEN 2013 AND 2025
GROUP BY
    id_gestion,
    id_periodo,
    estado,
    observacion,
    CASE
        WHEN nota IS NULL AND nota_2da IS NULL THEN 'SIN_NOTA'
        WHEN GREATEST(nota, nota_2da) > 50 THEN 'APROBADO_NUMERICO'
        WHEN GREATEST(nota, nota_2da) > 0
             AND GREATEST(nota, nota_2da) <= 50 THEN 'REPROBADO_NUMERICO'
        WHEN GREATEST(nota, nota_2da) = 0 THEN 'CERO'
        ELSE 'REVISAR_VALOR'
    END
ORDER BY id_gestion, id_periodo, estado, observacion, resultado_numerico;


-- 5. Control de notas nulas/fuera de rango y cobertura de periodos (2000-2025).
--    Un cero no se interpreta automaticamente como inasistencia.
SELECT
    id_gestion,
    id_periodo,
    COUNT(*) AS intentos,
    SUM(CASE WHEN nota IS NULL AND nota_2da IS NULL THEN 1 ELSE 0 END) AS ambos_nulos,
    SUM(CASE WHEN GREATEST(nota, nota_2da) < 0 THEN 1 ELSE 0 END) AS bajo_cero,
    SUM(CASE WHEN GREATEST(nota, nota_2da) > 100 THEN 1 ELSE 0 END) AS sobre_cien,
    SUM(CASE WHEN GREATEST(nota, nota_2da) = 0 THEN 1 ELSE 0 END) AS nota_cero
FROM academico.notas_planilla
WHERE id_gestion BETWEEN 2000 AND 2025
GROUP BY id_gestion, id_periodo
ORDER BY id_gestion, id_periodo;


-- 6. Proxy exploratorio de parciales con valor no cero.
--    Los campos tienen DEFAULT 0 en el DDL local; esto NO demuestra asistencia.
SELECT
    id_gestion,
    id_periodo,
    CASE WHEN pparcial IS NOT NULL AND pparcial <> 0 THEN 1 ELSE 0 END
      + CASE WHEN sparcial IS NOT NULL AND sparcial <> 0 THEN 1 ELSE 0 END
      + CASE WHEN tparcial IS NOT NULL AND tparcial <> 0 THEN 1 ELSE 0 END
      + CASE WHEN cparcial IS NOT NULL AND cparcial <> 0 THEN 1 ELSE 0 END
      AS parciales_con_valor_no_cero,
    COUNT(*) AS filas
FROM academico.notas_planilla
WHERE id_gestion BETWEEN 2013 AND 2025
  AND id_periodo < 3
GROUP BY
    id_gestion,
    id_periodo,
    CASE WHEN pparcial IS NOT NULL AND pparcial <> 0 THEN 1 ELSE 0 END
      + CASE WHEN sparcial IS NOT NULL AND sparcial <> 0 THEN 1 ELSE 0 END
      + CASE WHEN tparcial IS NOT NULL AND tparcial <> 0 THEN 1 ELSE 0 END
      + CASE WHEN cparcial IS NOT NULL AND cparcial <> 0 THEN 1 ELSE 0 END
ORDER BY id_gestion, id_periodo, parciales_con_valor_no_cero;


-- 7. Distribucion agregada por estudiante/periodo para explorar la regla de
--    abandono: porcentaje aprobado y cantidad de parciales con valor no cero.
--    No devuelve id_alumno. Es una consulta potencialmente costosa: ejecutar
--    solo con autorizacion TI/DBA y fuera del horario operativo.
WITH por_estudiante AS (
    SELECT
        np.id_gestion,
        np.id_periodo,
        np.id_alumno,
        SUM(CASE WHEN GREATEST(np.nota, np.nota_2da) > 50 THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE
                WHEN GREATEST(np.nota, np.nota_2da) > 0
                 AND GREATEST(np.nota, np.nota_2da) <= 50 THEN 1
                ELSE 0
            END) AS reprobadas,
        SUM(CASE WHEN GREATEST(np.nota, np.nota_2da) = 0 THEN 1 ELSE 0 END) AS ceros,
        SUM(CASE WHEN np.pparcial IS NOT NULL AND np.pparcial <> 0 THEN 1 ELSE 0 END
          + CASE WHEN np.sparcial IS NOT NULL AND np.sparcial <> 0 THEN 1 ELSE 0 END
          + CASE WHEN np.tparcial IS NOT NULL AND np.tparcial <> 0 THEN 1 ELSE 0 END
          + CASE WHEN np.cparcial IS NOT NULL AND np.cparcial <> 0 THEN 1 ELSE 0 END
        ) AS parciales_con_valor_no_cero
    FROM academico.notas_planilla np
    JOIN academico.alumnos al ON al.id_alumno = np.id_alumno
    JOIN academico.alm_programas pr ON pr.id_programa = al.id_programa
    JOIN academico.pln_materias pm ON pm.id_materia = np.id_materia
    WHERE np.id_gestion BETWEEN 2013 AND 2025
      AND np.id_periodo < 3
      AND pr.id_programa NOT IN ('EDI','EDT','EXI','EXQ','LAT','OJO','PCO','UTI')
      AND pm.sigla NOT IN ('PRE000','CPA360','CPA612','OPT012','OPT1','OPT2','OPT3','VJA000')
      AND np.id_materia NOT IN (3699,3700,3701,3702,3703,6514,6515,6516,6517,6518,8742,8743,8744,8876)
    GROUP BY np.id_gestion, np.id_periodo, np.id_alumno
), clasificados AS (
    SELECT
        id_gestion,
        id_periodo,
        CASE
            WHEN parciales_con_valor_no_cero < 2 THEN 'MENOS_DE_DOS_PARCIALES_CON_VALOR'
            ELSE 'DOS_O_MAS_PARCIALES_CON_VALOR'
        END AS grupo_parciales,
        CASE
            WHEN aprobadas + reprobadas = 0 THEN 'SIN_NOTAS_EVALUABLES'
            WHEN aprobadas * 100.0 / (aprobadas + reprobadas) < 50 THEN 'APROBACION_MENOR_50_PCT'
            WHEN aprobadas * 100.0 / (aprobadas + reprobadas) < 75 THEN 'APROBACION_50_A_75_PCT'
            ELSE 'APROBACION_75_PCT_O_MAS'
        END AS grupo_porcentaje_aprobacion,
        ceros
    FROM por_estudiante
)
SELECT
    id_gestion,
    id_periodo,
    grupo_parciales,
    grupo_porcentaje_aprobacion,
    COUNT(*) AS estudiantes_periodo,
    SUM(ceros) AS intentos_con_nota_cero
FROM clasificados
GROUP BY id_gestion, id_periodo, grupo_parciales, grupo_porcentaje_aprobacion
ORDER BY id_gestion, id_periodo, grupo_parciales, grupo_porcentaje_aprobacion;


-- 8. Distribucion de postulantes: estado, estado_postulacion y corte.
SELECT
    id_gestion,
    id_periodo,
    estado,
    estado_postulacion,
    COUNT(*) AS postulaciones
FROM public.postulantes
WHERE id_gestion BETWEEN 2000 AND 2025
GROUP BY id_gestion, id_periodo, estado, estado_postulacion
ORDER BY id_gestion, id_periodo, estado, estado_postulacion;


-- 9. Validar candidatos de grano de FACT_ADMISION sin exponer claves.
--    La tabla tiene serial id_alumno en el DDL local; el grano necesita validar
--    también si hay más de una fila para la combinacion programa/corte/alumno.
SELECT COUNT(*) AS grupos_id_alumno_duplicados
FROM (
    SELECT id_alumno
    FROM public.postulantes
    GROUP BY id_alumno
    HAVING COUNT(*) > 1
) d;

SELECT COUNT(*) AS grupos_programa_gestion_periodo_id_duplicados
FROM (
    SELECT id_programa, id_gestion, id_periodo, id_alumno
    FROM public.postulantes
    GROUP BY id_programa, id_gestion, id_periodo, id_alumno
    HAVING COUNT(*) > 1
) d;


-- 10. Cobertura/duplicidad de la identidad id_ra y referencias de postulantes.
--     La primera consulta recorre public.uatf_datos completo; ejecutar fuera de
--     horario operativo y con aprobacion TI/DBA.
SELECT
    COUNT(*) AS filas_persona,
    COUNT(id_ra) AS filas_con_id_ra,
    COUNT(DISTINCT id_ra) AS id_ra_distintos,
    COUNT(id_ra) - COUNT(DISTINCT id_ra) AS filas_por_encima_de_id_ra_unico
FROM public.uatf_datos;

SELECT
    COUNT(*) AS postulantes_en_rango,
    SUM(CASE WHEN EXISTS (
        SELECT 1 FROM public.uatf_datos u WHERE u.id_ra = p.id_ra
    ) THEN 1 ELSE 0 END) AS postulantes_con_persona_en_uatf_datos,
    SUM(CASE WHEN EXISTS (
        SELECT 1 FROM academico.alm_programas pr
        WHERE pr.id_programa = p.id_programa
    ) THEN 1 ELSE 0 END) AS postulantes_con_programa_existente
FROM public.postulantes p
WHERE p.id_gestion BETWEEN 2000 AND 2025;


-- 11. Impacto de exclusiones de programas para FACT_CURSADO/retencion.
SELECT
    CASE
        WHEN al.id_programa IS NULL THEN 'PROGRAMA_NULO'
        WHEN al.id_programa IN ('EDI','EDT','EXI','EXQ','LAT','OJO','PCO','UTI')
            THEN 'PROGRAMA_EXCLUIDO'
        ELSE 'PROGRAMA_INCLUIDO'
    END AS grupo_programa,
    COUNT(*) AS intentos
FROM academico.notas_planilla np
JOIN academico.alumnos al ON al.id_alumno = np.id_alumno
WHERE np.id_gestion BETWEEN 2013 AND 2025
  AND np.id_periodo < 3
GROUP BY 1
ORDER BY 1;


-- 12. Impacto de exclusiones de materias y referencias sin coincidencia.
SELECT
    CASE
        WHEN pm.id_materia IS NULL THEN 'MATERIA_SIN_COINCIDENCIA'
        WHEN pm.sigla IN ('PRE000','CPA360','CPA612','OPT012','OPT1','OPT2','OPT3','VJA000')
          OR np.id_materia IN (3699,3700,3701,3702,3703,6514,6515,6516,6517,6518,8742,8743,8744,8876)
            THEN 'MATERIA_EXCLUIDA'
        ELSE 'MATERIA_INCLUIDA'
    END AS grupo_materia,
    COUNT(*) AS intentos
FROM academico.notas_planilla np
LEFT JOIN academico.pln_materias pm ON pm.id_materia = np.id_materia
WHERE np.id_gestion BETWEEN 2013 AND 2025
  AND np.id_periodo < 3
GROUP BY 1
ORDER BY 1;


-- 13. Cobertura de facultades/programas: los resultados son solo conteos.
SELECT
    COUNT(*) AS programas,
    COUNT(DISTINCT p.id_programa) AS codigos_programa_distintos,
    SUM(CASE WHEN EXISTS (
        SELECT 1
        FROM academico.alm_programas_facultades f
        WHERE f.id_facultad = p.id_facultad
    ) THEN 1 ELSE 0 END) AS programas_con_facultad_existente,
    SUM(CASE WHEN NOT EXISTS (
        SELECT 1
        FROM academico.alm_programas_facultades f
        WHERE f.id_facultad = p.id_facultad
    ) THEN 1 ELSE 0 END) AS programas_sin_facultad_coincidente
FROM academico.alm_programas p;


-- 14. Tablas/columnas candidatas a conservar historia de alumnos.
--     Solo devuelve metadatos, no filas de negocio.
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'academico'
  AND (
      table_name ILIKE '%alumn%'
      OR table_name ILIKE '%hist%'
      OR table_name ILIKE '%audit%'
  )
ORDER BY table_name, ordinal_position;


-- 15. Graduacion: cobertura por anio/gestion y programa, sin datos personales.
--     fecha_graduacion e id_gestion pueden diferir; la salida permite detectarlo.
--     Esta fuente se incluye para evaluar FACT_GRADUATION, no para asumir su grano.
SELECT
    CASE
        WHEN fecha_graduacion IS NOT NULL THEN EXTRACT(YEAR FROM fecha_graduacion)::integer
        ELSE id_gestion::integer
    END AS anio_referencia,
    id_gestion,
    id_programa,
    COUNT(*) AS registros_graduado,
    COUNT(DISTINCT id_alumno) AS alumnos_distintos,
    SUM(CASE WHEN id_alumno IS NULL THEN 1 ELSE 0 END) AS filas_sin_id_alumno,
    SUM(CASE WHEN fecha_graduacion IS NULL THEN 1 ELSE 0 END) AS filas_sin_fecha_graduacion,
    SUM(CASE WHEN id_programa IS NULL THEN 1 ELSE 0 END) AS filas_sin_programa,
    SUM(CASE
            WHEN fecha_graduacion IS NOT NULL
             AND id_gestion IS NOT NULL
             AND EXTRACT(YEAR FROM fecha_graduacion)::integer <> id_gestion
            THEN 1 ELSE 0
        END) AS filas_fecha_y_gestion_no_coinciden
FROM actas_graduacion.graduados
WHERE (fecha_graduacion >= DATE '2000-01-01'
       AND fecha_graduacion < DATE '2026-01-01')
   OR id_gestion BETWEEN 2000 AND 2025
GROUP BY
    CASE
        WHEN fecha_graduacion IS NOT NULL THEN EXTRACT(YEAR FROM fecha_graduacion)::integer
        ELSE id_gestion::integer
    END,
    id_gestion,
    id_programa
ORDER BY anio_referencia, id_gestion, id_programa;


-- 16. Referencias y claves candidatas de graduados: solo conteos agregados.
SELECT
    COUNT(*) AS registros_graduado_en_rango,
    SUM(CASE WHEN g.id_alumno IS NULL THEN 1 ELSE 0 END) AS registros_sin_id_alumno,
    SUM(CASE WHEN g.id_alumno IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM academico.alumnos al WHERE al.id_alumno = g.id_alumno
    ) THEN 1 ELSE 0 END) AS registros_sin_alumno_coincidente,
    SUM(CASE WHEN g.id_programa IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM academico.alm_programas p WHERE p.id_programa = g.id_programa
    ) THEN 1 ELSE 0 END) AS registros_sin_programa_coincidente
FROM actas_graduacion.graduados g
WHERE (g.fecha_graduacion >= DATE '2000-01-01'
       AND g.fecha_graduacion < DATE '2026-01-01')
   OR g.id_gestion BETWEEN 2000 AND 2025;

SELECT COUNT(*) AS grupos_candidatos_graduacion_repetidos
FROM (
    SELECT id_alumno, id_programa, id_modalidad, fecha_graduacion, id_gestion
    FROM actas_graduacion.graduados
    WHERE (fecha_graduacion >= DATE '2000-01-01'
           AND fecha_graduacion < DATE '2026-01-01')
       OR id_gestion BETWEEN 2000 AND 2025
    GROUP BY id_alumno, id_programa, id_modalidad, fecha_graduacion, id_gestion
    HAVING COUNT(*) > 1
) d;


-- 17. Finalizar explicitamente sin modificar datos.
ROLLBACK;
