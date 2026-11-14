-- 0056: applicant profile and full admission mode for FACT_ADMISION (DSA Boletín 1).
--
-- * The admission profile came only from the linked academic student (55 % of
--   applications). Hop now sends the applicant's own data (public.uatf_datos and
--   public.prs_colegios by id_ra): sex, school type, school location and place of
--   birth, stored on fact_admision.
-- * postulantes.id_acceso is empty since 2019; Hop sends the mode from
--   postulantes.examen (same public.prs_examen codes), up to 3 digits
--   (111 = "Examen P.S.A. sin curso de nivelación"): id_acceso widened.
-- * Catalog of the six RAN knowledge areas per program (Boletín 1, section III)
--   and departmental capitals for the "ciudad / provincia" split (section VI).

DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_admission(uuid,bigint,jsonb)') IS NULL
       OR to_regprocedure('etl_control.publish_hop_staged_run(uuid,uuid,text)') IS NULL
       OR to_regclass('dw.vw_dim_admision_olap') IS NULL THEN
        RAISE EXCEPTION '0056 requires the admission staging, the publisher and the 0047 OLAP views';
    END IF;
END;
$$;

SET ROLE dw_owner;

-- ------------------------------------------------------------ admission mode
DROP VIEW dw.vw_dim_admision_olap;
ALTER TABLE dw.dim_admision ALTER COLUMN id_acceso TYPE VARCHAR(4);
CREATE VIEW dw.vw_dim_admision_olap AS
SELECT a.admision_sk,
       coalesce(nullif(btrim(a.id_acceso), ''), '-') AS modalidad_codigo,
       coalesce(r.nombre, CASE WHEN nullif(btrim(a.id_acceso), '') IS NULL THEN 'Sin modalidad registrada'
                               ELSE 'Modalidad ' || btrim(a.id_acceso) END) AS modalidad,
       coalesce(r.grupo, CASE WHEN nullif(btrim(a.id_acceso), '') IS NULL THEN 'Sin modalidad registrada'
                              ELSE 'Otras modalidades' END) AS grupo
FROM dw.dim_admision a
LEFT JOIN dw.ref_modalidad_admision r ON r.codigo = btrim(a.id_acceso);

-- ---------------------------------------------------------- applicant profile
ALTER TABLE dw.fact_admision
    ADD COLUMN IF NOT EXISTS postulante_sexo VARCHAR(1),
    ADD COLUMN IF NOT EXISTS postulante_tipo_colegio VARCHAR(1),
    ADD COLUMN IF NOT EXISTS colegio_pais INTEGER,
    ADD COLUMN IF NOT EXISTS colegio_departamento INTEGER,
    ADD COLUMN IF NOT EXISTS colegio_provincia INTEGER,
    ADD COLUMN IF NOT EXISTS nacimiento_pais INTEGER,
    ADD COLUMN IF NOT EXISTS nacimiento_departamento INTEGER,
    ADD COLUMN IF NOT EXISTS nacimiento_provincia INTEGER;
COMMENT ON COLUMN dw.fact_admision.postulante_sexo IS '0056: uatf_datos.id_sexo of the applicant (id_ra).';
COMMENT ON COLUMN dw.fact_admision.postulante_tipo_colegio IS '0056: prs_colegios.tipo of the applicant school (F fiscal, P particular, C convenio).';
COMMENT ON COLUMN dw.fact_admision.colegio_departamento IS '0056: prs_colegios.cod_dep (procedencia educativa).';
COMMENT ON COLUMN dw.fact_admision.nacimiento_departamento IS '0056: uatf_datos.id_dep (lugar de nacimiento).';

DO $$
DECLARE
    v_definition TEXT;
BEGIN
    v_definition := pg_get_functiondef('etl_control.stage_hop_fact_admission(uuid,bigint,jsonb)'::REGPROCEDURE);
    IF position('postulante_sexo' IN v_definition) = 0 THEN
        IF position('v_id_acceso CHAR(2);' IN v_definition) = 0
           OR position($q$v_id_acceso := nullif(btrim(p_source_data->>'id_acceso'),'')::char(2);$q$ IN v_definition) = 0
           OR position($q$'estado_origen',v_estado$q$ IN v_definition) = 0 THEN
            RAISE EXCEPTION '0056 did not find the expected admission staging code';
        END IF;
        v_definition := replace(v_definition, 'v_id_acceso CHAR(2);', 'v_id_acceso VARCHAR(4);');
        v_definition := replace(v_definition,
            $q$v_id_acceso := nullif(btrim(p_source_data->>'id_acceso'),'')::char(2);$q$,
            $q$v_id_acceso := coalesce(nullif(btrim(p_source_data->>'modalidad'),''), nullif(btrim(p_source_data->>'id_acceso'),''))::varchar(4); -- 0056$q$);
        v_definition := replace(v_definition,
            $q$'estado_origen',v_estado$q$,
            $q$'estado_origen',v_estado,
        -- 0056: applicant profile (absent keys stay NULL).
        'postulante_sexo',nullif(upper(btrim(p_source_data->>'postulante_sexo')),''),
        'postulante_tipo_colegio',nullif(upper(btrim(p_source_data->>'postulante_tipo_colegio')),''),
        'colegio_pais',nullif(p_source_data->>'colegio_pais','')::integer,
        'colegio_departamento',nullif(p_source_data->>'colegio_departamento','')::integer,
        'colegio_provincia',nullif(p_source_data->>'colegio_provincia','')::integer,
        'nacimiento_pais',nullif(p_source_data->>'nacimiento_pais','')::integer,
        'nacimiento_departamento',nullif(p_source_data->>'nacimiento_departamento','')::integer,
        'nacimiento_provincia',nullif(p_source_data->>'nacimiento_provincia','')::integer$q$);
        EXECUTE v_definition;
    END IF;

    v_definition := pg_get_functiondef('etl_control.publish_hop_staged_run(uuid,uuid,text)'::REGPROCEDURE);
    IF position('x.postulante_sexo' IN v_definition) = 0 THEN
        IF position('es_admitido, puntaje_examen, estado_origen, run_id' IN v_definition) = 0
           OR position('x.conteo_postulacion, x.es_admitido, x.puntaje_examen, x.estado_origen, p_run_id' IN v_definition) = 0 THEN
            RAISE EXCEPTION '0056 did not find the FACT_ADMISION insert in the publisher';
        END IF;
        v_definition := replace(v_definition, 'es_admitido, puntaje_examen, estado_origen, run_id',
            'es_admitido, puntaje_examen, estado_origen, run_id, postulante_sexo, postulante_tipo_colegio, colegio_pais, colegio_departamento, colegio_provincia, nacimiento_pais, nacimiento_departamento, nacimiento_provincia');
        v_definition := replace(v_definition, 'x.conteo_postulacion, x.es_admitido, x.puntaje_examen, x.estado_origen, p_run_id',
            'x.conteo_postulacion, x.es_admitido, x.puntaje_examen, x.estado_origen, p_run_id, x.postulante_sexo, x.postulante_tipo_colegio, x.colegio_pais, x.colegio_departamento, x.colegio_provincia, x.nacimiento_pais, x.nacimiento_departamento, x.nacimiento_provincia');
        EXECUTE v_definition;
    END IF;
END;
$$;

-- ------------------------------------------------- knowledge areas (RAN)
CREATE TABLE IF NOT EXISTS dw.ref_area_conocimiento (
    codigo VARCHAR(8) PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    orden SMALLINT NOT NULL
);
INSERT INTO dw.ref_area_conocimiento (codigo, nombre, orden) VALUES
    ('CNP', 'Ciencias Puras y Naturales', 1),
    ('ITC', 'Ingeniería, Tecnología y Construcción', 2),
    ('CAFP', 'Ciencias Agrícolas, Forestales y Pecuarias', 3),
    ('CCSS', 'Ciencias de la Salud', 4),
    ('CJSAH', 'Ciencias Jurídicas, Sociales, Artes y Humanidades', 5),
    ('CEAFC', 'Ciencias Económicas, Administrativas, Financieras y Comerciales', 6)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden;

CREATE TABLE IF NOT EXISTS dw.ref_programa_area (
    id_programa VARCHAR(3) PRIMARY KEY,
    area VARCHAR(8) NOT NULL REFERENCES dw.ref_area_conocimiento (codigo)
);
INSERT INTO dw.ref_programa_area (id_programa, area) VALUES
    ('EST','CNP'), ('FIS','CNP'), ('MAT','CNP'), ('QMC','CNP'), ('QUI','CNP'),
    ('IGO','ITC'), ('IMA','ITC'), ('IAM','ITC'), ('IMI','ITC'), ('MIN','ITC'), ('PMM','ITC'),
    ('ELE','ITC'), ('TED','ITC'), ('TSE','ITC'), ('IET','ITC'), ('TEA','ITC'), ('IND','ITC'),
    ('IMC','ITC'), ('TMG','ITC'), ('TSM','ITC'), ('IMT','ITC'), ('MAU','ITC'), ('TMA','ITC'),
    ('TSA','ITC'), ('INF','ITC'), ('CIN','ITC'), ('SIS','ITC'), ('DPD','ITC'), ('SIT','ITC'),
    ('CIV','ITC'), ('GYT','ITC'), ('CCV','ITC'), ('ARQ','ITC'),
    ('AGR','CAFP'), ('IAI','CAFP'), ('IDT','CAFP'), ('IDR','CAFP'), ('VAG','CAFP'), ('MVZ','CAFP'),
    ('ENF','CCSS'), ('TMF','CCSS'), ('LEF','CCSS'), ('PEN','CCSS'), ('VEF','CCSS'), ('MED','CCSS'), ('ODO','CCSS'),
    ('DER','CJSAH'), ('DET','CJSAH'), ('CDE','CJSAH'), ('LEI','CJSAH'), ('ULI','CJSAH'), ('CLI','CJSAH'),
    ('TCS','CJSAH'), ('CTS','CJSAH'), ('TUR','CJSAH'), ('TUU','CJSAH'), ('COM','CJSAH'),
    ('APT','CJSAH'), ('ARM','CJSAH'), ('PIC','CJSAH'),
    ('ADM','CEAFC'), ('COP','CEAFC'), ('CTT','CEAFC'), ('CTB','CEAFC'), ('ECO','CEAFC'), ('CEC','CEAFC'),
    ('UEC','CEAFC'), ('ICO','CEAFC'), ('VCI','CEAFC')
ON CONFLICT (id_programa) DO UPDATE SET area = EXCLUDED.area;

COMMENT ON TABLE dw.ref_area_conocimiento IS '0056: six knowledge areas of the II-XIII RAN (Reunión Académica Nacional), DSA Boletín 1.';
COMMENT ON TABLE dw.ref_programa_area IS '0056: program to RAN area, from DSA Boletín 1 section III (PIC assigned to humanities).';

-- Departmental capitals: "ciudad" vs "provincia".
ALTER TABLE dw.ref_provincia ADD COLUMN IF NOT EXISTS es_capital BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE dw.ref_provincia SET es_capital = (codigo IN (1, 11, 108, 109, 2, 107, 82, 110, 68));
COMMENT ON COLUMN dw.ref_provincia.es_capital IS
    '0056: capital province of the department (Oropeza, Murillo, Cercado CBBA/ORU/TJA/BEN, Tomás Frías, Andrés Ibáñez, Nicolás Suárez).';

-- ----------------------------------------------------------- OLAP views
CREATE OR REPLACE VIEW dw.vw_dim_programa_olap AS
SELECT p.programa_sk,
       coalesce(p.id_facultad, -1) AS facultad_codigo,
       coalesce(p.facultad, 'Sin facultad') AS facultad,
       coalesce(p.id_programa, '---') AS carrera_codigo,
       coalesce(p.programa, 'Sin carrera') AS carrera,
       coalesce(p.sede, '-') AS sede_codigo,
       coalesce(s.nombre, CASE WHEN p.sede IS NULL THEN 'Sin sede' ELSE 'Sede ' || p.sede END) AS sede,
       coalesce(p.regimen, '-') AS regimen_codigo,
       CASE p.regimen WHEN 'A' THEN 'Anual' WHEN 'S' THEN 'Semestral' WHEN 'P' THEN 'Programa'
            ELSE 'Sin régimen' END AS regimen,
       -- 0056
       coalesce(pa.area, '-') AS area_codigo,
       coalesce(ac.nombre, 'Sin área asignada') AS area,
       coalesce(ac.orden, 99)::smallint AS area_orden
FROM dw.dim_programa p
LEFT JOIN dw.ref_sede s ON s.codigo = p.sede
LEFT JOIN dw.ref_programa_area pa ON pa.id_programa = p.id_programa
LEFT JOIN dw.ref_area_conocimiento ac ON ac.codigo = pa.area;

-- Location key: department * 1000 + province (0 = province unknown);
-- -2 abroad, -1 no data. Bolivia is country 27 in the Jachasun catalogs.
CREATE OR REPLACE FUNCTION dw.olap_ubicacion_key(p_pais INTEGER, p_departamento INTEGER, p_provincia INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_departamento BETWEEN 1 AND 9 AND coalesce(p_pais, 27) = 27
            THEN p_departamento * 1000 + CASE WHEN p_provincia > 0 THEN p_provincia ELSE 0 END
        WHEN p_pais IS NOT NULL AND p_pais NOT IN (27, -1, 0) THEN -2
        WHEN p_departamento IS NOT NULL AND p_departamento > 9 THEN -2
        ELSE -1
    END
$$;
ALTER FUNCTION dw.olap_ubicacion_key(INTEGER, INTEGER, INTEGER) OWNER TO dw_owner;
GRANT EXECUTE ON FUNCTION dw.olap_ubicacion_key(INTEGER, INTEGER, INTEGER) TO dw_reader;

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
    -- 0056: applicant profile (degenerate attributes of the application).
    coalesce(f.postulante_sexo, '-')::varchar(1) AS sexo_codigo,
    coalesce(f.postulante_tipo_colegio, '-')::varchar(1) AS tipo_colegio_codigo,
    dw.olap_ubicacion_key(f.colegio_pais, f.colegio_departamento, f.colegio_provincia) AS colegio_ubicacion,
    dw.olap_ubicacion_key(f.nacimiento_pais, f.nacimiento_departamento, f.nacimiento_provincia) AS nacimiento_ubicacion,
    pa.gestion::integer AS gestion
FROM dw.fact_admision f
LEFT JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = f.periodo_academico_sk;

CREATE OR REPLACE VIEW dw.vw_dim_sexo_olap AS
SELECT codigo, nombre FROM (VALUES ('F', 'Femenino'), ('M', 'Masculino'), ('-', 'Sin dato')) v(codigo, nombre);

CREATE OR REPLACE VIEW dw.vw_dim_tipo_colegio_olap AS
SELECT codigo, nombre FROM (VALUES ('F', 'Fiscal'), ('P', 'Particular'), ('C', 'Convenio'), ('-', 'Sin dato')) v(codigo, nombre);

-- Every location key that can appear, with the DSA "ciudad / provincia" scope.
CREATE OR REPLACE VIEW dw.vw_dim_ubicacion_olap AS
WITH keys AS (
    SELECT d.codigo * 1000 + p.codigo AS ubicacion, d.codigo AS departamento, p.codigo AS provincia,
           d.nombre AS departamento_nombre, p.nombre AS provincia_nombre, p.es_capital
    FROM dw.ref_provincia p JOIN dw.ref_departamento d ON d.codigo = p.departamento
    UNION ALL
    SELECT d.codigo * 1000, d.codigo, 0, d.nombre, 'Provincia sin dato', FALSE
    FROM dw.ref_departamento d WHERE d.codigo BETWEEN 1 AND 9
    UNION ALL
    -- Province codes outside the catalog: keep the department.
    SELECT DISTINCT k.ubicacion, k.ubicacion / 1000, k.ubicacion % 1000, d.nombre,
           'Provincia ' || (k.ubicacion % 1000), FALSE
    FROM (SELECT colegio_ubicacion AS ubicacion FROM dw.vw_fact_admision_olap
          UNION SELECT nacimiento_ubicacion FROM dw.vw_fact_admision_olap) k
    JOIN dw.ref_departamento d ON d.codigo = k.ubicacion / 1000
    WHERE k.ubicacion > 0 AND k.ubicacion % 1000 > 0
      AND NOT EXISTS (SELECT 1 FROM dw.ref_provincia p WHERE p.codigo = k.ubicacion % 1000 AND p.departamento = k.ubicacion / 1000)
)
SELECT ubicacion,
       CASE WHEN departamento = 5 AND es_capital THEN 'Potosí – ciudad'
            WHEN departamento = 5 THEN 'Potosí – provincias'
            WHEN es_capital THEN 'Otros departamentos – ciudad'
            ELSE 'Otros departamentos – provincias' END AS ambito,
       CASE WHEN departamento = 5 AND es_capital THEN 1 WHEN departamento = 5 THEN 2
            WHEN es_capital THEN 3 ELSE 4 END AS ambito_orden,
       departamento, departamento_nombre, provincia_nombre
FROM keys
UNION ALL SELECT -2, 'Exterior', 5, -2, 'Exterior', 'Exterior'
UNION ALL SELECT -1, 'Sin dato', 6, -1, 'Sin dato', 'Sin dato';

REVOKE ALL ON dw.ref_area_conocimiento, dw.ref_programa_area, dw.vw_dim_sexo_olap,
    dw.vw_dim_tipo_colegio_olap, dw.vw_dim_ubicacion_olap, dw.vw_dim_admision_olap FROM PUBLIC;
GRANT SELECT ON dw.ref_area_conocimiento, dw.ref_programa_area, dw.vw_dim_sexo_olap,
    dw.vw_dim_tipo_colegio_olap, dw.vw_dim_ubicacion_olap, dw.vw_dim_admision_olap TO dw_reader;

RESET ROLE;
