-- 0059: fast location keys for the admission cube.
--
-- 0058 computed the location key with dw.olap_ubicacion_key(), which looks up
-- the capital city with a subquery for every row, and vw_dim_ubicacion_olap
-- re-read the fact view to find out-of-catalog provinces: "Procedencia
-- educativa" and "Lugar de nacimiento" queries took 30-40 s. The capital flag
-- now comes from a join, and the dimension reads the raw fact columns. The key
-- values are unchanged.

SET ROLE dw_owner;

CREATE OR REPLACE VIEW dw.vw_fact_admision_olap AS
SELECT f.fact_admision_id,
    f.estudiante_sk,
    CASE WHEN f.estudiante_sk > 0 THEN f.estudiante_sk END AS applicant_person_sk,
    CASE WHEN f.es_admitido IS TRUE AND f.estudiante_sk > 0 THEN f.estudiante_sk END AS admitted_person_sk,
    CASE WHEN f.es_admitido IS NOT NULL AND f.estudiante_sk > 0 THEN f.estudiante_sk END AS known_outcome_person_sk,
    f.programa_sk,
    f.periodo_academico_sk,
    f.admision_sk,
    f.conteo_postulacion,
    (CASE WHEN f.es_admitido IS TRUE THEN f.conteo_postulacion::integer ELSE 0 END)::smallint AS conteo_admitido,
    (CASE WHEN f.es_admitido IS NOT NULL THEN f.conteo_postulacion::integer ELSE 0 END)::smallint AS conteo_resultado_conocido,
    f.puntaje_examen,
    f.id_alumno_origen AS postulante_ref,
    (CASE WHEN f.es_admitido IS FALSE THEN f.conteo_postulacion::integer ELSE 0 END)::smallint AS conteo_no_admitido,
    coalesce(f.postulante_sexo, '-')::varchar(1) AS sexo_codigo,
    coalesce(f.postulante_tipo_colegio, '-')::varchar(1) AS tipo_colegio_codigo,
    CASE
        WHEN f.colegio_departamento BETWEEN 1 AND 9 AND coalesce(f.colegio_pais, 27) = 27
            THEN f.colegio_departamento * 10000
                 + CASE WHEN f.colegio_provincia > 0 AND f.colegio_provincia < 1000 THEN f.colegio_provincia ELSE 0 END * 10
                 + (cc.cod_localidad IS NOT NULL)::integer
        WHEN f.colegio_pais IS NOT NULL AND f.colegio_pais NOT IN (27, -1, 0) THEN -2
        WHEN f.colegio_departamento > 9 THEN -2
        ELSE -1
    END AS colegio_ubicacion,
    CASE
        WHEN f.nacimiento_departamento BETWEEN 1 AND 9 AND coalesce(f.nacimiento_pais, 27) = 27
            THEN f.nacimiento_departamento * 10000
                 + CASE WHEN f.nacimiento_provincia > 0 AND f.nacimiento_provincia < 1000 THEN f.nacimiento_provincia ELSE 0 END * 10
                 + (nc.cod_localidad IS NOT NULL)::integer
        WHEN f.nacimiento_pais IS NOT NULL AND f.nacimiento_pais NOT IN (27, -1, 0) THEN -2
        WHEN f.nacimiento_departamento > 9 THEN -2
        ELSE -1
    END AS nacimiento_ubicacion,
    pa.gestion::integer AS gestion
FROM dw.fact_admision f
LEFT JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = f.periodo_academico_sk
LEFT JOIN dw.ref_ciudad_capital cc ON cc.cod_localidad = f.colegio_localidad AND cc.departamento = f.colegio_departamento
LEFT JOIN dw.ref_ciudad_capital nc ON nc.cod_localidad = f.nacimiento_localidad AND nc.departamento = f.nacimiento_departamento;

CREATE OR REPLACE VIEW dw.vw_dim_ubicacion_olap AS
WITH provinces AS (
    SELECT p.departamento, p.codigo AS provincia, p.nombre AS provincia_nombre
    FROM dw.ref_provincia p
    UNION ALL
    SELECT d.codigo, 0, 'Provincia sin dato' FROM dw.ref_departamento d WHERE d.codigo BETWEEN 1 AND 9
    UNION ALL
    -- Province codes outside the catalog that appear in the facts (raw columns).
    SELECT DISTINCT x.departamento, x.provincia, 'Provincia ' || x.provincia
    FROM (SELECT colegio_departamento AS departamento, colegio_provincia AS provincia FROM dw.fact_admision
          UNION SELECT nacimiento_departamento, nacimiento_provincia FROM dw.fact_admision) x
    WHERE x.departamento BETWEEN 1 AND 9 AND x.provincia > 0 AND x.provincia < 1000
      AND NOT EXISTS (SELECT 1 FROM dw.ref_provincia p WHERE p.codigo = x.provincia AND p.departamento = x.departamento)
), keys AS (
    SELECT pr.departamento * 10000 + pr.provincia * 10 + v.flag AS ubicacion,
           pr.departamento, d.nombre AS departamento_nombre,
           CASE WHEN v.flag = 1 THEN 'Ciudad de ' || c.nombre ELSE pr.provincia_nombre END AS provincia_nombre,
           v.flag = 1 AS es_ciudad
    FROM provinces pr
    JOIN dw.ref_departamento d ON d.codigo = pr.departamento
    CROSS JOIN (VALUES (0), (1)) v(flag)
    LEFT JOIN dw.ref_ciudad_capital c ON c.departamento = pr.departamento
    WHERE v.flag = 0 OR c.cod_localidad IS NOT NULL
)
SELECT ubicacion,
       CASE WHEN departamento = 5 AND es_ciudad THEN 'Potosí – ciudad'
            WHEN departamento = 5 THEN 'Potosí – provincias'
            WHEN es_ciudad THEN 'Otros departamentos – ciudad'
            ELSE 'Otros departamentos – provincias' END AS ambito,
       CASE WHEN departamento = 5 AND es_ciudad THEN 1 WHEN departamento = 5 THEN 2
            WHEN es_ciudad THEN 3 ELSE 4 END AS ambito_orden,
       departamento, departamento_nombre, provincia_nombre
FROM keys
UNION ALL SELECT -2, 'Exterior', 5, -2, 'Exterior', 'Exterior'
UNION ALL SELECT -1, 'Sin dato', 6, -1, 'Sin dato', 'Sin dato';

RESET ROLE;
