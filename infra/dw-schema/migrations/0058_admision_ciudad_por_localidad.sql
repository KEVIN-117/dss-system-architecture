-- 0058: "ciudad" in DSA Boletín 1 is the capital city (locality), not the whole
-- capital province. With the province rule 0056 put 6,437 applications of 2019
-- in Potosí city vs 6,187 in the bulletin; by locality it is 6,217 (school) and
-- 5,119 vs 5,116 (birth). fact_admision keeps the school and birth localities,
-- and the OLAP location key carries a capital-city flag.

SET ROLE dw_owner;

CREATE TABLE IF NOT EXISTS dw.ref_ciudad_capital (
    cod_localidad INTEGER PRIMARY KEY,
    departamento SMALLINT NOT NULL,
    nombre VARCHAR(60) NOT NULL
);
INSERT INTO dw.ref_ciudad_capital (cod_localidad, departamento, nombre) VALUES
    (2794, 1, 'Sucre'), (2690, 2, 'La Paz'), (821, 3, 'Cochabamba'), (2059, 4, 'Oruro'),
    (1494, 5, 'Potosí'), (2680, 6, 'Tarija'), (2234, 7, 'Santa Cruz de la Sierra'),
    (2526, 8, 'Trinidad'), (2773, 9, 'Cobija')
ON CONFLICT (cod_localidad) DO UPDATE SET departamento = EXCLUDED.departamento, nombre = EXCLUDED.nombre;
COMMENT ON TABLE dw.ref_ciudad_capital IS '0058: capital city locality of each department (public.lugar_localidad, Jachasun 2026-11).';

ALTER TABLE dw.fact_admision
    ADD COLUMN IF NOT EXISTS colegio_localidad INTEGER,
    ADD COLUMN IF NOT EXISTS nacimiento_localidad INTEGER;

DO $$
DECLARE
    v_definition TEXT;
BEGIN
    v_definition := pg_get_functiondef('etl_control.stage_hop_fact_admission(uuid,bigint,jsonb)'::REGPROCEDURE);
    IF position('colegio_localidad' IN v_definition) = 0 THEN
        IF position($q$'nacimiento_provincia',nullif(p_source_data->>'nacimiento_provincia','')::integer$q$ IN v_definition) = 0 THEN
            RAISE EXCEPTION '0058 did not find the 0056 profile keys in stage_hop_fact_admission';
        END IF;
        EXECUTE replace(v_definition,
            $q$'nacimiento_provincia',nullif(p_source_data->>'nacimiento_provincia','')::integer$q$,
            $q$'nacimiento_provincia',nullif(p_source_data->>'nacimiento_provincia','')::integer,
        'colegio_localidad',nullif(p_source_data->>'colegio_localidad','')::integer,
        'nacimiento_localidad',nullif(p_source_data->>'nacimiento_localidad','')::integer$q$);
    END IF;

    v_definition := pg_get_functiondef('etl_control.publish_hop_staged_run(uuid,uuid,text)'::REGPROCEDURE);
    IF position('x.colegio_localidad' IN v_definition) = 0 THEN
        IF position('nacimiento_departamento, nacimiento_provincia' IN v_definition) = 0
           OR position('x.nacimiento_departamento, x.nacimiento_provincia' IN v_definition) = 0 THEN
            RAISE EXCEPTION '0058 did not find the 0056 FACT_ADMISION columns in the publisher';
        END IF;
        v_definition := replace(v_definition, 'x.nacimiento_departamento, x.nacimiento_provincia',
            'x.nacimiento_departamento, x.nacimiento_provincia, x.colegio_localidad, x.nacimiento_localidad');
        v_definition := replace(v_definition, 'nacimiento_departamento, nacimiento_provincia
',
            'nacimiento_departamento, nacimiento_provincia, colegio_localidad, nacimiento_localidad
');
        IF position('nacimiento_provincia, colegio_localidad, nacimiento_localidad' IN v_definition) = 0 THEN
            -- Column list and SELECT list are on one line each.
            v_definition := replace(v_definition, 'nacimiento_departamento, nacimiento_provincia)',
                'nacimiento_departamento, nacimiento_provincia, colegio_localidad, nacimiento_localidad)');
        END IF;
        EXECUTE v_definition;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.backfill_hop_admission_profile(p_rows JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, dw
AS $$
DECLARE
    v_updated BIGINT;
    v_code TEXT;
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
        RAISE EXCEPTION 'Se esperaba un arreglo de postulaciones' USING ERRCODE = '22023';
    END IF;
    FOR v_code IN
        SELECT DISTINCT nullif(btrim(e->>'modalidad'), '')
        FROM jsonb_array_elements(p_rows) e
        WHERE nullif(btrim(e->>'modalidad'), '') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dw.dim_admision a
                          WHERE a.member_type = 'STANDARD' AND a.id_acceso = btrim(e->>'modalidad'))
    LOOP
        INSERT INTO dw.dim_admision (admision_sk, member_type, id_acceso, created_at, updated_at)
        VALUES (etl_control.resolve_hop_dimension_key('admision', v_code), 'STANDARD', v_code::varchar(4),
                clock_timestamp(), clock_timestamp());
    END LOOP;

    WITH src AS (
        SELECT (e->>'id_alumno_origen')::integer AS id_alumno_origen,
               nullif(btrim(e->>'modalidad'), '') AS modalidad,
               nullif(upper(btrim(e->>'postulante_sexo')), '')::varchar(1) AS sexo,
               nullif(upper(btrim(e->>'postulante_tipo_colegio')), '')::varchar(1) AS tipo_colegio,
               nullif(e->>'colegio_pais', '')::integer AS colegio_pais,
               nullif(e->>'colegio_departamento', '')::integer AS colegio_departamento,
               nullif(e->>'colegio_provincia', '')::integer AS colegio_provincia,
               nullif(e->>'colegio_localidad', '')::integer AS colegio_localidad,
               nullif(e->>'nacimiento_pais', '')::integer AS nacimiento_pais,
               nullif(e->>'nacimiento_departamento', '')::integer AS nacimiento_departamento,
               nullif(e->>'nacimiento_provincia', '')::integer AS nacimiento_provincia,
               nullif(e->>'nacimiento_localidad', '')::integer AS nacimiento_localidad
        FROM jsonb_array_elements(p_rows) e
    ), resolved AS (
        SELECT s.*, coalesce(a.admision_sk, u.admision_sk) AS admision_sk
        FROM src s
        LEFT JOIN dw.dim_admision a ON a.member_type = 'STANDARD' AND a.id_acceso = s.modalidad
        CROSS JOIN (SELECT admision_sk FROM dw.dim_admision WHERE member_type = 'UNKNOWN') u
    )
    UPDATE dw.fact_admision f
    SET admision_sk = r.admision_sk,
        postulante_sexo = r.sexo,
        postulante_tipo_colegio = r.tipo_colegio,
        colegio_pais = r.colegio_pais,
        colegio_departamento = r.colegio_departamento,
        colegio_provincia = r.colegio_provincia,
        colegio_localidad = r.colegio_localidad,
        nacimiento_pais = r.nacimiento_pais,
        nacimiento_departamento = r.nacimiento_departamento,
        nacimiento_provincia = r.nacimiento_provincia,
        nacimiento_localidad = r.nacimiento_localidad
    FROM resolved r
    WHERE f.id_alumno_origen = r.id_alumno_origen
      AND (f.admision_sk, f.postulante_sexo, f.postulante_tipo_colegio, f.colegio_pais, f.colegio_departamento,
           f.colegio_provincia, f.colegio_localidad, f.nacimiento_pais, f.nacimiento_departamento,
           f.nacimiento_provincia, f.nacimiento_localidad)
          IS DISTINCT FROM
          (r.admision_sk, r.sexo, r.tipo_colegio, r.colegio_pais, r.colegio_departamento,
           r.colegio_provincia, r.colegio_localidad, r.nacimiento_pais, r.nacimiento_departamento,
           r.nacimiento_provincia, r.nacimiento_localidad);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

-- Location key: Bolivia = department*10000 + province*10 + capital-city flag
-- (province 0 when unknown); -2 abroad; -1 no data.
CREATE OR REPLACE FUNCTION dw.olap_ubicacion_key(p_pais INTEGER, p_departamento INTEGER, p_provincia INTEGER, p_localidad INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p_departamento BETWEEN 1 AND 9 AND coalesce(p_pais, 27) = 27
            THEN p_departamento * 10000
                 + CASE WHEN p_provincia > 0 AND p_provincia < 1000 THEN p_provincia ELSE 0 END * 10
                 + CASE WHEN EXISTS (SELECT 1 FROM dw.ref_ciudad_capital c
                                     WHERE c.cod_localidad = p_localidad AND c.departamento = p_departamento)
                        THEN 1 ELSE 0 END
        WHEN p_pais IS NOT NULL AND p_pais NOT IN (27, -1, 0) THEN -2
        WHEN p_departamento IS NOT NULL AND p_departamento > 9 THEN -2
        ELSE -1
    END
$$;
ALTER FUNCTION dw.olap_ubicacion_key(INTEGER, INTEGER, INTEGER, INTEGER) OWNER TO dw_owner;
GRANT EXECUTE ON FUNCTION dw.olap_ubicacion_key(INTEGER, INTEGER, INTEGER, INTEGER) TO dw_reader;

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
    dw.olap_ubicacion_key(f.colegio_pais, f.colegio_departamento, f.colegio_provincia, f.colegio_localidad) AS colegio_ubicacion,
    dw.olap_ubicacion_key(f.nacimiento_pais, f.nacimiento_departamento, f.nacimiento_provincia, f.nacimiento_localidad) AS nacimiento_ubicacion,
    pa.gestion::integer AS gestion
FROM dw.fact_admision f
LEFT JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = f.periodo_academico_sk;

CREATE OR REPLACE VIEW dw.vw_dim_ubicacion_olap AS
WITH provinces AS (
    SELECT p.departamento, p.codigo AS provincia, p.nombre AS provincia_nombre
    FROM dw.ref_provincia p
    UNION ALL
    SELECT d.codigo, 0, 'Provincia sin dato' FROM dw.ref_departamento d WHERE d.codigo BETWEEN 1 AND 9
    UNION ALL
    -- Province codes outside the catalog that appear in the facts.
    SELECT DISTINCT k / 10000, (k / 10) % 1000, 'Provincia ' || ((k / 10) % 1000)
    FROM (SELECT colegio_ubicacion AS k FROM dw.vw_fact_admision_olap
          UNION SELECT nacimiento_ubicacion FROM dw.vw_fact_admision_olap) f
    WHERE k > 0 AND (k / 10) % 1000 > 0
      AND NOT EXISTS (SELECT 1 FROM dw.ref_provincia p
                      WHERE p.codigo = (k / 10) % 1000 AND p.departamento = k / 10000)
), keys AS (
    SELECT pr.departamento * 10000 + pr.provincia * 10 + flag AS ubicacion,
           pr.departamento, d.nombre AS departamento_nombre,
           CASE WHEN flag = 1 THEN 'Ciudad de ' || c.nombre ELSE pr.provincia_nombre END AS provincia_nombre,
           flag = 1 AS es_ciudad
    FROM provinces pr
    JOIN dw.ref_departamento d ON d.codigo = pr.departamento
    CROSS JOIN (VALUES (0), (1)) v(flag)
    LEFT JOIN dw.ref_ciudad_capital c ON c.departamento = pr.departamento
    WHERE flag = 0 OR c.cod_localidad IS NOT NULL
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

GRANT SELECT ON dw.ref_ciudad_capital TO dw_reader;
DROP FUNCTION IF EXISTS dw.olap_ubicacion_key(INTEGER, INTEGER, INTEGER);

RESET ROLE;
