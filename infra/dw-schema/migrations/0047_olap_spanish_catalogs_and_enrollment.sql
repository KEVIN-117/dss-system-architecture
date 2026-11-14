-- 0047: descriptive OLAP layer in Spanish (catalogs, new students, enrollment).
--
-- The OLAP cubes showed raw source codes (sede C/N/T, tipo de colegio F/P/C,
-- sexo F/M, modalidad de admisión 1/2/20) and could not answer "who are the
-- new students". This migration adds, without touching published facts:
--   * reference catalogs (dw.ref_*) with the descriptions of Jachasun
--     (academico.sedes, public.lugar_departamento, public.lugar_provincia,
--     public.prs_examen; snapshot 2026-11). The admission-mode groups are an
--     analytical grouping of the project, not a source attribute;
--   * fact_retencion_desercion.tipo_estudiante / gestion_ingreso: NUEVO when
--     the cut is the student's first coursework cut in the program, ANTIGUO
--     afterwards, SIN_HISTORIAL when that first cut is the first processed
--     closure of the DW (the real start may be earlier). Point in time; filled
--     at publication by refresh_hop_retention_performance();
--   * dimension views vw_dim_*_olap with descriptive Spanish names and
--     non-null keys, and the enrollment fact view vw_fact_matricula_olap;
--   * additive columns on the existing fact views (appended, contract kept).

DO $$
BEGIN
    IF to_regprocedure('etl_control.refresh_hop_retention_performance(bigint[])') IS NULL
       OR to_regclass('dw.vw_fact_cursado_olap') IS NULL
       OR to_regclass('dw.vw_fact_admision_olap') IS NULL
       OR to_regclass('dw.vw_fact_retencion_olap') IS NULL THEN
        RAISE EXCEPTION '0047 requires 0035/0043 OLAP views and 0046 retention performance';
    END IF;
END;
$$;

SET ROLE dw_owner;

-- ---------------------------------------------------------------- catalogs
CREATE TABLE IF NOT EXISTS dw.ref_sede (
    codigo VARCHAR(1) PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL
);
INSERT INTO dw.ref_sede (codigo, nombre) VALUES
    ('C', 'Central'), ('N', 'Uncía'), ('S', 'Sacaca'), ('T', 'Tupiza'), ('U', 'Uyuni'), ('V', 'Villazón')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

CREATE TABLE IF NOT EXISTS dw.ref_departamento (
    codigo SMALLINT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL
);
INSERT INTO dw.ref_departamento (codigo, nombre) VALUES
    (0, 'Otro'), (1, 'Chuquisaca'), (2, 'La Paz'), (3, 'Cochabamba'), (4, 'Oruro'),
    (5, 'Potosí'), (6, 'Tarija'), (7, 'Santa Cruz'), (8, 'Beni'), (9, 'Pando')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

CREATE TABLE IF NOT EXISTS dw.ref_provincia (
    codigo INTEGER PRIMARY KEY,
    departamento SMALLINT NOT NULL,
    nombre VARCHAR(60) NOT NULL
);
INSERT INTO dw.ref_provincia (codigo, departamento, nombre) VALUES
    (1, 1, 'Oropeza'),
    (2, 5, 'Tomas Frias'),
    (3, 1, 'Azurduy'),
    (4, 1, 'Tomina'),
    (5, 1, 'Hernando Siles'),
    (6, 1, 'Yamparaez'),
    (7, 1, 'Nor Cinti'),
    (8, 1, 'B. Boeto'),
    (9, 1, 'Sud Cinti'),
    (10, 1, 'Luis Calvo'),
    (11, 2, 'Murillo'),
    (12, 2, 'Omasuyos'),
    (13, 2, 'Pacajes'),
    (14, 2, 'Camacho'),
    (15, 2, 'Larecaja'),
    (16, 2, 'Franz Tamayo'),
    (17, 2, 'Ingavi'),
    (18, 2, 'Loayza'),
    (19, 2, 'Inquisivi'),
    (20, 2, 'Sud Yungas'),
    (21, 2, 'Los Andes'),
    (22, 2, 'Aroma'),
    (23, 2, 'Nor Yungas'),
    (24, 2, 'Iturralde'),
    (25, 2, 'Bautista Saavedra'),
    (26, 2, 'Manco Kapac'),
    (27, 2, 'Gualberto Villarroel'),
    (28, 2, 'Gral. Jose Manuel Pando'),
    (29, 2, 'Caranavi'),
    (30, 7, 'German Busch'),
    (31, 3, 'Campero'),
    (32, 3, 'Ayopaya'),
    (33, 3, 'Esteban Arce'),
    (34, 3, 'Arani'),
    (35, 3, 'Arque'),
    (36, 3, 'Capinota'),
    (37, 3, 'German Jordan'),
    (38, 3, 'Quillacollo'),
    (39, 3, 'Chapare'),
    (40, 3, 'Tapacari'),
    (41, 3, 'Carrasco'),
    (42, 3, 'Mizque'),
    (43, 3, 'Punata'),
    (44, 3, 'Bolivar'),
    (45, 3, 'Tiraque'),
    (46, 7, 'Guarayos'),
    (47, 4, 'Avaroa'),
    (48, 4, 'Carangas'),
    (49, 4, 'Sajama'),
    (50, 4, 'Litoral'),
    (51, 4, 'Poopo'),
    (52, 4, 'Pantaleon Dalence'),
    (53, 4, 'Ladislao Cabrera'),
    (54, 4, 'Sabaya'),
    (55, 4, 'Saucari'),
    (56, 4, 'Tomas Barron'),
    (57, 4, 'Sud Carangas'),
    (58, 4, 'San Pedro De Totora'),
    (59, 4, 'Sebastian Pagador'),
    (60, 4, 'Mejillones'),
    (61, 4, 'Nor Carangas'),
    (62, 8, 'Vaca Diez'),
    (63, 8, 'Gral. J. Ballivian'),
    (64, 8, 'Yacuma'),
    (65, 8, 'Moxos'),
    (66, 8, 'Marban'),
    (67, 8, 'Mamore'),
    (68, 9, 'Nicolas Suarez'),
    (69, 9, 'Manuripi'),
    (70, 9, 'Madre De Dios'),
    (71, 9, 'Gral. Federico Roman'),
    (72, 5, 'Rafael Bustillo'),
    (73, 5, 'Cornelio Saavedra'),
    (74, 5, 'Chayanta'),
    (75, 5, 'Charcas'),
    (76, 5, 'Nor Chichas'),
    (77, 6, 'Arce'),
    (78, 6, 'Gran Chaco'),
    (79, 6, 'Aviles'),
    (80, 6, 'Mendez'),
    (81, 6, 'O''connor'),
    (82, 7, 'Andres Ibañez'),
    (83, 7, 'Warnes'),
    (84, 7, 'Velasco'),
    (85, 7, 'Ichilo'),
    (86, 7, 'Chiquitos'),
    (87, 7, 'Sara'),
    (88, 7, 'Cordillera'),
    (89, 7, 'Vallegrande'),
    (90, 7, 'Florida'),
    (91, 7, 'Obispo Santistevan'),
    (92, 7, 'Ñuflo De Chavez'),
    (93, 7, 'Angel Sandoval'),
    (94, 7, 'Manuel Maria Caballero'),
    (95, 5, 'Sud Chichas'),
    (96, 5, 'Nor Lipez'),
    (97, 5, 'Sud Lipez'),
    (98, 5, 'Jose Maria Linares'),
    (99, 5, 'Antonio Quijarro'),
    (100, 5, 'Daniel Campos'),
    (101, 5, 'Modesto Omiste'),
    (102, 5, 'Gral. B. Bilbao'),
    (103, 5, 'Enrique Baldivieso'),
    (104, 9, 'Abuna'),
    (105, 1, 'Zudañez'),
    (106, 2, 'Muñecas'),
    (107, 6, 'Cercado'),
    (108, 3, 'Cercado'),
    (109, 4, 'Cercado'),
    (110, 8, 'Cercado'),
    (111, 5, 'Alonzo De Ibañez'),
    (112, 8, 'Itenez'),
    (162, 1, 'Cercado')
ON CONFLICT (codigo) DO UPDATE SET departamento = EXCLUDED.departamento, nombre = EXCLUDED.nombre;

CREATE TABLE IF NOT EXISTS dw.ref_modalidad_admision (
    codigo VARCHAR(8) PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    grupo VARCHAR(60) NOT NULL
);
INSERT INTO dw.ref_modalidad_admision (codigo, nombre, grupo) VALUES
    ('0', 'Otras modalidades', 'Admisiones especiales'),
    ('1', 'Examen P.S.A.', 'Examen P.S.A.'),
    ('2', 'Curso preuniversitario', 'Cursos preuniversitarios'),
    ('3', 'Examen P.S.A. (2.ª convocatoria)', 'Examen P.S.A.'),
    ('4', 'Curso premédico', 'Cursos preuniversitarios'),
    ('5', 'Ingreso directo', 'Ingreso directo y excelencia'),
    ('6', 'Admisión por excelencia académica', 'Ingreso directo y excelencia'),
    ('7', 'Admisión extraordinaria deportiva', 'Ingreso directo y excelencia'),
    ('8', 'Admisión especial (profesionales)', 'Admisiones especiales'),
    ('9', 'Convenio C.A.O.P.', 'Convenios'),
    ('10', 'Carrera simultánea', 'Traspasos y cambios'),
    ('11', 'CRISCOS', 'Admisiones especiales'),
    ('12', 'Extranjero', 'Admisiones especiales'),
    ('13', 'Traspaso', 'Traspasos y cambios'),
    ('14', 'Convenio de cooperación', 'Convenios'),
    ('15', 'Cambio de carrera', 'Traspasos y cambios'),
    ('16', 'Convenio F.S.U.T.C.O.Q.P.', 'Convenios'),
    ('17', 'Convenio Coroma', 'Convenios'),
    ('18', 'Convenio C.E.N.A.Q.', 'Convenios'),
    ('19', 'Convenio Medicina - Brasil', 'Convenios'),
    ('20', 'Examen P.S.A. (3.ª convocatoria)', 'Examen P.S.A.'),
    ('21', 'Convenio Tahua', 'Convenios'),
    ('22', 'Convalidación prefacultativo', 'Cursos preuniversitarios'),
    ('23', 'Convenio FENCOMIN', 'Convenios'),
    ('24', 'Admisión CODEPEDIS', 'Admisiones especiales'),
    ('25', 'Homologación', 'Traspasos y cambios'),
    ('26', 'Convenio interinstitucional', 'Convenios'),
    ('27', 'Convenio C.S.U.T.C.B.', 'Convenios'),
    ('28', 'Convenio Andrés Bello', 'Convenios'),
    ('29', 'Transferencia entre sedes', 'Traspasos y cambios'),
    ('30', 'Excelencia académica por promedio', 'Ingreso directo y excelencia'),
    ('31', 'Promedio igual o mayor a 60 en el área', 'Ingreso directo y excelencia'),
    ('32', 'Olimpiadas científicas', 'Ingreso directo y excelencia'),
    ('33', 'Cambio por anulación de carrera (preuniversitario)', 'Traspasos y cambios'),
    ('34', 'Cambio por anulación de carrera (P.S.A.)', 'Traspasos y cambios'),
    ('35', 'Curso prefacultativo de Derecho', 'Cursos preuniversitarios'),
    ('36', 'Traspaso de universidades', 'Traspasos y cambios'),
    ('37', 'Convenio Consejo de Ayllus de Puna', 'Convenios'),
    ('38', 'Convenio Ravelo', 'Convenios'),
    ('39', 'CODEMETROP', 'Admisiones especiales'),
    ('40', 'Convenio F.S.U.T.O.N.P.', 'Convenios'),
    ('41', 'Admisión directa por convenio', 'Convenios'),
    ('42', 'Estudiantes indígenas originarios campesinos', 'Admisiones especiales'),
    ('43', 'Personas con discapacidad', 'Admisiones especiales'),
    ('44', 'Examen P.S.A. (4.ª convocatoria)', 'Examen P.S.A.'),
    ('45', 'Convenio Comando Departamental de Policía', 'Convenios'),
    ('46', 'Convenio Defensa Civil Potosí', 'Convenios'),
    ('50', 'Otros convenios', 'Convenios'),
    ('111', 'Examen P.S.A. sin curso de nivelación', 'Examen P.S.A.'),
    ('116', 'Examen P.S.A. en modalidades especiales', 'Examen P.S.A.')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, grupo = EXCLUDED.grupo;

COMMENT ON TABLE dw.ref_sede IS '0047: academico.sedes (Jachasun, 2026-11).';
COMMENT ON TABLE dw.ref_departamento IS '0047: public.lugar_departamento, Bolivia (Jachasun, 2026-11).';
COMMENT ON TABLE dw.ref_provincia IS '0047: public.lugar_provincia, Bolivia; codigo = cod_prov (Jachasun, 2026-11).';
COMMENT ON TABLE dw.ref_modalidad_admision IS
    '0047: public.prs_examen (postulantes.id_acceso). grupo is an analytical grouping of the project.';

-- ------------------------------------------- new / returning students
ALTER TABLE dw.fact_retencion_desercion
    ADD COLUMN IF NOT EXISTS tipo_estudiante VARCHAR(16),
    ADD COLUMN IF NOT EXISTS gestion_ingreso SMALLINT;
ALTER TABLE dw.fact_retencion_desercion DROP CONSTRAINT IF EXISTS ck_fact_retencion_tipo_estudiante;
ALTER TABLE dw.fact_retencion_desercion ADD CONSTRAINT ck_fact_retencion_tipo_estudiante
    CHECK (tipo_estudiante IS NULL OR tipo_estudiante IN ('NUEVO', 'ANTIGUO', 'SIN_HISTORIAL'));
COMMENT ON COLUMN dw.fact_retencion_desercion.tipo_estudiante IS
    '0047: NUEVO (first coursework cut of the student in the program), ANTIGUO, or SIN_HISTORIAL (first cut is the first processed closure, so the real start is unknown).';
COMMENT ON COLUMN dw.fact_retencion_desercion.gestion_ingreso IS
    '0047: gestion of the first coursework cut in the program; NULL when SIN_HISTORIAL.';

-- 0046 rule plus the 0047 new/returning attributes, computed in one pass.
CREATE OR REPLACE FUNCTION etl_control.refresh_hop_retention_performance(
    p_closure_ids BIGINT[]
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, dw
SET work_mem = '256MB'
AS $$
DECLARE
    v_updated BIGINT;
BEGIN
    IF p_closure_ids IS NULL OR cardinality(p_closure_ids) = 0 THEN
        RETURN 0;
    END IF;

    WITH history_start AS MATERIALIZED (
        -- First processed semester/annual-cadence closure of the DW.
        SELECT c.gestion, c.periodo
        FROM etl_control.academic_period_closure c
        WHERE c.status = 'PROCESADO' AND c.periodo IN (1, 2)
        ORDER BY c.gestion, c.periodo
        LIMIT 1
    ), target_rows AS MATERIALIZED (
        SELECT f.fact_retencion_desercion_id AS id, f.programa_sk, e.id_alumno,
               c.effective_at, c.gestion, c.periodo
        FROM dw.fact_retencion_desercion f
        JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
        JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk AND e.member_type = 'STANDARD'
        WHERE f.closure_id = ANY (p_closure_ids)
          AND c.status = 'PROCESADO'
    ), history AS MATERIALIZED (
        -- Every attempt of the target students, read once; the point-in-time
        -- bound is applied by the hash join below.
        SELECT he.id_alumno, fc.programa_sk, hc.effective_at, hc.gestion, hc.periodo,
               CASE WHEN m.member_type = 'STANDARD' THEN m.id_materia END AS id_materia,
               etl_control.coursework_pass_outcome(fc.nota_final, fc.nota_complementaria, fc.nota_examen_mesa) AS passed,
               GREATEST(fc.nota_final, fc.nota_complementaria, fc.nota_examen_mesa) AS grade
        FROM dw.dim_estudiante he
        JOIN dw.fact_cursado fc ON fc.estudiante_sk = he.estudiante_sk
        JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = fc.periodo_academico_sk
        JOIN etl_control.academic_period_closure hc ON hc.closure_id = pa.closure_id
          AND hc.status = 'PROCESADO'
        JOIN dw.dim_materia m ON m.materia_sk = fc.materia_sk
        WHERE he.member_type = 'STANDARD'
          AND he.id_alumno IN (SELECT DISTINCT id_alumno FROM target_rows)
    ), attempts AS MATERIALIZED (
        SELECT t.id, h.id_materia, h.passed, h.grade, h.gestion, h.periodo
        FROM target_rows t
        JOIN history h ON h.id_alumno = t.id_alumno AND h.programa_sk = t.programa_sk
                      AND h.effective_at <= t.effective_at
    ), per_subject AS (
        SELECT id, id_materia, bool_or(passed) AS any_pass, bool_or(NOT passed) AS any_fail
        FROM attempts
        WHERE passed IS NOT NULL AND id_materia IS NOT NULL
        GROUP BY id, id_materia
    ), carried AS (
        SELECT id, count(*) FILTER (WHERE any_fail AND NOT any_pass)::integer AS carried
        FROM per_subject
        GROUP BY id
    ), performance AS (
        SELECT a.id,
               round(avg(a.grade) FILTER (WHERE a.passed IS NOT NULL AND a.id_materia IS NOT NULL), 2) AS ppa,
               min(ARRAY[a.gestion, a.periodo]) AS first_cut
        FROM attempts a
        GROUP BY a.id
    ), computed AS (
        -- per_subject only holds known outcomes: no row there means no evidence.
        SELECT t.id,
               CASE WHEN cr.id IS NOT NULL THEN p.ppa END AS ppa,
               cr.carried,
               CASE
                   WHEN p.first_cut IS NULL THEN NULL
                   WHEN hs.gestion IS NOT NULL AND p.first_cut = ARRAY[hs.gestion, hs.periodo]::smallint[]
                       THEN 'SIN_HISTORIAL'
                   WHEN p.first_cut = ARRAY[t.gestion, t.periodo]::smallint[] THEN 'NUEVO'
                   ELSE 'ANTIGUO'
               END::varchar(16) AS tipo_estudiante,
               CASE
                   WHEN p.first_cut IS NULL THEN NULL
                   WHEN hs.gestion IS NOT NULL AND p.first_cut = ARRAY[hs.gestion, hs.periodo]::smallint[] THEN NULL
                   ELSE p.first_cut[1]
               END::smallint AS gestion_ingreso
        FROM target_rows t
        LEFT JOIN history_start hs ON TRUE
        LEFT JOIN carried cr ON cr.id = t.id
        LEFT JOIN performance p ON p.id = t.id
    )
    UPDATE dw.fact_retencion_desercion f
    SET ppa_acumulado = c.ppa,
        materias_arrastradas = c.carried,
        tipo_estudiante = c.tipo_estudiante,
        gestion_ingreso = c.gestion_ingreso
    FROM computed c
    WHERE f.fact_retencion_desercion_id = c.id
      AND (f.ppa_acumulado IS DISTINCT FROM c.ppa
           OR f.materias_arrastradas IS DISTINCT FROM c.carried
           OR f.tipo_estudiante IS DISTINCT FROM c.tipo_estudiante
           OR f.gestion_ingreso IS DISTINCT FROM c.gestion_ingreso);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION etl_control.refresh_hop_retention_performance(BIGINT[]) IS
    '0046/0047: point-in-time ppa_acumulado, materias_arrastradas, tipo_estudiante and gestion_ingreso for published retention rows of the given PROCESADO closures; returns changed rows. Owner-only. Recompute every closure if earlier history is loaded later.';

-- ------------------------------------------------------- dimension views
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
            ELSE 'Sin régimen' END AS regimen
FROM dw.dim_programa p
LEFT JOIN dw.ref_sede s ON s.codigo = p.sede;

CREATE OR REPLACE VIEW dw.vw_dim_periodo_olap AS
SELECT pa.periodo_academico_sk,
       coalesce(pa.gestion, 0)::smallint AS gestion,
       coalesce(pa.gestion::text, 'Sin gestión') AS gestion_nombre,
       coalesce(pa.periodo, 0)::smallint AS periodo,
       CASE WHEN pa.periodo IS NULL THEN 'Sin periodo' ELSE 'Periodo ' || pa.periodo END AS periodo_nombre
FROM dw.dim_periodo_academico pa;

CREATE OR REPLACE VIEW dw.vw_dim_estudiante_olap AS
SELECT e.estudiante_sk,
       coalesce(e.id_sexo, '-') AS sexo_codigo,
       CASE e.id_sexo WHEN 'F' THEN 'Femenino' WHEN 'M' THEN 'Masculino' ELSE 'Sin dato' END AS sexo,
       coalesce(e.tipo_colegio, '-') AS tipo_colegio_codigo,
       CASE e.tipo_colegio WHEN 'F' THEN 'Fiscal' WHEN 'P' THEN 'Particular' WHEN 'C' THEN 'Convenio'
            ELSE 'Sin dato' END AS tipo_colegio,
       coalesce(e.gestion_egreso_colegio, 0)::integer AS egreso_colegio,
       coalesce(e.gestion_egreso_colegio::text, 'Sin dato') AS egreso_colegio_nombre,
       geo.departamento_codigo, geo.departamento, geo.provincia_codigo, geo.provincia,
       coalesce(e.cod_localidad, -1)::integer AS localidad_codigo,
       coalesce(initcap(btrim(e.localidad)), 'Sin dato') AS localidad
FROM dw.dim_estudiante e
CROSS JOIN LATERAL (
    SELECT CASE WHEN e.cod_pais = 27 AND e.cod_departamento >= 0 THEN e.cod_departamento
                WHEN e.cod_pais IS NOT NULL AND e.cod_pais NOT IN (27, -1) THEN -2
                ELSE -1 END::integer AS departamento_codigo,
           CASE WHEN e.cod_pais = 27 AND e.cod_departamento >= 0 THEN coalesce(d.nombre, 'Departamento ' || e.cod_departamento)
                WHEN e.cod_pais IS NOT NULL AND e.cod_pais NOT IN (27, -1) THEN 'Extranjero'
                ELSE 'Sin dato' END AS departamento,
           CASE WHEN e.cod_pais = 27 AND e.cod_provincia > 0 THEN e.cod_provincia ELSE -1 END::integer AS provincia_codigo,
           CASE WHEN e.cod_pais = 27 AND e.cod_provincia > 0 THEN coalesce(pr.nombre, 'Provincia ' || e.cod_provincia)
                ELSE 'Sin dato' END AS provincia
    FROM (SELECT 1) one
    LEFT JOIN dw.ref_departamento d ON d.codigo = e.cod_departamento
    LEFT JOIN dw.ref_provincia pr ON pr.codigo = e.cod_provincia
) geo;

CREATE OR REPLACE VIEW dw.vw_dim_admision_olap AS
SELECT a.admision_sk,
       coalesce(nullif(btrim(a.id_acceso), ''), '-') AS modalidad_codigo,
       coalesce(r.nombre, CASE WHEN nullif(btrim(a.id_acceso), '') IS NULL THEN 'Sin modalidad registrada'
                               ELSE 'Modalidad ' || btrim(a.id_acceso) END) AS modalidad,
       coalesce(r.grupo, CASE WHEN nullif(btrim(a.id_acceso), '') IS NULL THEN 'Sin modalidad registrada'
                              ELSE 'Otras modalidades' END) AS grupo
FROM dw.dim_admision a
LEFT JOIN dw.ref_modalidad_admision r ON r.codigo = btrim(a.id_acceso);

CREATE OR REPLACE VIEW dw.vw_dim_tipo_estudiante_olap AS
SELECT codigo, nombre, orden
FROM (VALUES ('NUEVO', 'Nuevo', 1), ('ANTIGUO', 'Antiguo', 2),
             ('SIN_HISTORIAL', 'Sin historial previo', 3), ('SIN_DATO', 'Sin dato', 4)) AS v(codigo, nombre, orden);

CREATE OR REPLACE VIEW dw.vw_dim_cohorte_olap AS
SELECT DISTINCT pa.gestion::integer AS cohorte, pa.gestion::text AS cohorte_nombre
FROM dw.dim_periodo_academico pa WHERE pa.gestion IS NOT NULL
UNION ALL
SELECT 0, 'Sin historial previo';

-- ------------------------------------------------------------ fact views
CREATE OR REPLACE VIEW dw.vw_fact_matricula_olap AS
SELECT f.fact_retencion_desercion_id,
       f.estudiante_sk,
       f.programa_sk,
       f.periodo_academico_sk,
       coalesce(f.tipo_estudiante, 'SIN_DATO')::varchar(16) AS tipo_estudiante,
       coalesce(f.gestion_ingreso, 0)::integer AS cohorte,
       1::smallint AS conteo_matricula,
       (f.tipo_estudiante = 'NUEVO')::integer::smallint AS conteo_nuevo,
       (f.tipo_estudiante = 'ANTIGUO')::integer::smallint AS conteo_antiguo,
       (f.tipo_estudiante = 'SIN_HISTORIAL')::integer::smallint AS conteo_sin_historial,
       f.materias_cursadas
FROM dw.fact_retencion_desercion f;

-- Existing contracts: columns appended at the end only.
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
    -- 0047: one postulación per source applicant record (postulantes.id_alumno).
    f.id_alumno_origen AS postulante_ref,
    (CASE WHEN f.es_admitido IS FALSE THEN f.conteo_postulacion::integer ELSE 0 END)::smallint AS conteo_no_admitido
FROM dw.fact_admision f;

CREATE OR REPLACE VIEW dw.vw_fact_retencion_olap AS
SELECT f.fact_retencion_desercion_id,
    f.estudiante_sk,
    f.programa_sk,
    f.periodo_academico_sk,
    f.closure_id,
    f.conteo_snapshot,
    f.conteo_evaluable,
    f.conteo_desercion,
    (CASE WHEN f.resultado_retencion = 'RETENIDO' THEN f.conteo_evaluable::integer ELSE 0 END)::smallint AS conteo_retenido,
    f.materias_cursadas,
    f.materias_aprobadas,
    f.materias_reprobadas,
    f.materias_arrastradas,
    f.ppa_acumulado,
    f.resultado_retencion,
    -- 0047
    coalesce(f.tipo_estudiante, 'SIN_DATO')::varchar(16) AS tipo_estudiante,
    coalesce(f.gestion_ingreso, 0)::integer AS cohorte,
    (f.conteo_snapshot - f.conteo_evaluable)::smallint AS conteo_no_evaluable
FROM dw.fact_retencion_desercion f;

CREATE OR REPLACE VIEW dw.vw_fact_cursado_olap AS
SELECT f.fact_cursado_id,
    f.estudiante_sk,
    f.programa_sk,
    f.materia_sk,
    f.periodo_academico_sk,
    f.conteo_intento,
    (CASE WHEN f.nota_final IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_calificado,
    (CASE WHEN f.es_aprobado IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_aprobado,
    (CASE WHEN f.es_reprobado IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_reprobado,
    (CASE WHEN f.es_repeticion IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_repeticion,
    (CASE WHEN f.es_abandono IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_abandono,
    f.nota_final,
    (CASE WHEN f.es_repeticion IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_repeticion_conocida,
    (CASE WHEN f.es_abandono IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_abandono_conocido,
    -- 0047: effective grade (0044 rule) only when the outcome is known, so
    -- averages are not pulled down by "no grade" zeros.
    CASE WHEN etl_control.coursework_pass_outcome(f.nota_final, f.nota_complementaria, f.nota_examen_mesa) IS NOT NULL
         THEN GREATEST(f.nota_final, f.nota_complementaria, f.nota_examen_mesa) END AS nota_efectiva,
    (CASE WHEN f.es_aprobado IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_con_resultado
FROM dw.fact_cursado f;

REVOKE ALL ON dw.ref_sede, dw.ref_departamento, dw.ref_provincia, dw.ref_modalidad_admision,
    dw.vw_dim_programa_olap, dw.vw_dim_periodo_olap, dw.vw_dim_estudiante_olap, dw.vw_dim_admision_olap,
    dw.vw_dim_tipo_estudiante_olap, dw.vw_dim_cohorte_olap, dw.vw_fact_matricula_olap FROM PUBLIC;
GRANT SELECT ON dw.ref_sede, dw.ref_departamento, dw.ref_provincia, dw.ref_modalidad_admision,
    dw.vw_dim_programa_olap, dw.vw_dim_periodo_olap, dw.vw_dim_estudiante_olap, dw.vw_dim_admision_olap,
    dw.vw_dim_tipo_estudiante_olap, dw.vw_dim_cohorte_olap, dw.vw_fact_matricula_olap TO dw_reader;

COMMENT ON VIEW dw.vw_fact_matricula_olap IS
    '0047: OLAP enrollment contract, one row per student/program/closed cut with coursework, with new/returning flags.';

-- Backfill new/returning attributes for published closures.
SELECT etl_control.refresh_hop_retention_performance(ARRAY(
    SELECT closure_id FROM etl_control.academic_period_closure WHERE status = 'PROCESADO'));

RESET ROLE;
