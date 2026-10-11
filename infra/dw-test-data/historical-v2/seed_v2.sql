-- Synthetic historical source dataset v2 for LOCAL ETL/DW integration testing only.
-- Source of truth for schema: infra/postgres-tx/ddl/ddl_jachasun.sql.
-- This seed is intentionally one-shot and refuses to run against populated OLTP tables.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
    IF current_database() <> 'jachasun_test' THEN
        RAISE EXCEPTION 'Refusing synthetic v2 seed: expected database jachasun_test, got %', current_database();
    END IF;
    IF (SELECT sum(n) FROM (
        SELECT count(*)::bigint n FROM public._bp_estados_civiles
        UNION ALL SELECT count(*) FROM public.prs_pais_v2
        UNION ALL SELECT count(*) FROM public.lugar_departamento
        UNION ALL SELECT count(*) FROM public.lugar_provincia
        UNION ALL SELECT count(*) FROM public.lugar_localidad
        UNION ALL SELECT count(*) FROM public.prs_colegios
        UNION ALL SELECT count(*) FROM public.uatf_datos
        UNION ALL SELECT count(*) FROM public.postulantes
        UNION ALL SELECT count(*) FROM public.fac_programas
        UNION ALL SELECT count(*) FROM academico.alm_programas_facultades
        UNION ALL SELECT count(*) FROM academico.alm_programas
        UNION ALL SELECT count(*) FROM academico.docentes
        UNION ALL SELECT count(*) FROM academico.pln_materias
        UNION ALL SELECT count(*) FROM academico.alumnos_estados
        UNION ALL SELECT count(*) FROM academico.carreras_tipos
        UNION ALL SELECT count(*) FROM academico.alumnos
        UNION ALL SELECT count(*) FROM academico.notas_planilla
        UNION ALL SELECT count(*) FROM academico.dct_asignaciones
        UNION ALL SELECT count(*) FROM academico.alm_programaciones
        UNION ALL SELECT count(*) FROM academico.alm_periodos
        UNION ALL SELECT count(*) FROM academico.periodos
    ) target_counts) <> 0 THEN
        RAISE EXCEPTION 'Refusing synthetic v2 seed: one or more target tables are not empty; no rows were changed';
    END IF;
END $$;

CREATE TEMP TABLE _dw_test_faculty (
    source_code char(1) PRIMARY KEY,
    faculty_name text NOT NULL,
    faculty_abbreviation text NOT NULL
) ON COMMIT DROP;
INSERT INTO _dw_test_faculty (source_code, faculty_name, faculty_abbreviation) VALUES
    ('A', 'FACULTAD DE ARTES', 'FAC. DE ARTES'),
    ('B', 'FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS', 'FAC. DE CC AA Y PP'),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA'),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS'),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH'),
    ('F', 'FACULTAD DE DERECHO', 'FAC. DE DERECHO'),
    ('G', 'FACULTAD DE INGENIERIA', 'FAC. DE ING.'),
    ('H', 'FACULTAD DE INGENIERIA GEOLOGICA', 'FAC. DE ING. GEOLOGICA'),
    ('I', 'FACULTAD DE INGENIERIA MINERA', 'FAC. DE ING. MINERA'),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA'),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD'),
    ('L', 'FACULTAD DE MEDICINA', 'FAC. DE MEDICINA'),
    ('M', 'VICERRECTORADO', 'VICERRECTORADO');

CREATE TEMP TABLE _dw_test_program (
    source_code char(1) NOT NULL,
    faculty_name text NOT NULL,
    faculty_abbreviation text NOT NULL,
    orden4 integer,
    orden5 integer,
    orden text,
    program_code char(3) PRIMARY KEY,
    program_name_variant text,
    program_name text NOT NULL,
    schedule_code char(1) NOT NULL CHECK (schedule_code IN ('A','S')),
    campus_label char(1),
    campus_source_id integer,
    active_code char(1),
    program_kind char(1),
    academic_level text NOT NULL,
    study_years smallint,
    area_code text,
    area_code_2 text,
    area_name text,
    orden3 char(1),
    orden2 text,
    program_rank integer NOT NULL
) ON COMMIT DROP;
INSERT INTO _dw_test_program (
    source_code, faculty_name, faculty_abbreviation, orden4, orden5, orden,
    program_code, program_name_variant, program_name, schedule_code, campus_label,
    campus_source_id, active_code, program_kind, academic_level, study_years,
    area_code, area_code_2, area_name, orden3, orden2, program_rank
) VALUES
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 30, 'C11', 'ADM', 'ADMINISTRACION DE EMPRESAS', 'ADMINISTRACION DE EMPRESAS', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U11', 1),
    ('B', 'FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS', 'FAC. DE CC AA Y PP', 2, 12, 'B11', 'AGR', 'INGENIERIA AGRONOMICA', 'ING. AGRONOMICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CAFP', 'CIENCIAS AGRICOLAS FORESTALES y PECUARIAS', 'CC., AGRIC., FOR. y PEC.', 'C', 'R11', 2),
    ('A', 'FACULTAD DE ARTES', 'FAC. DE ARTES', 1, 3, 'A11', 'APT', 'ARTES PLASTICAS', 'ARTES PLASTICAS', 'A', 'C', 1, 'A', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T33', 3),
    ('A', 'FACULTAD DE ARTES', 'FAC. DE ARTES', 1, 6, 'A14', 'ARM', 'ARTES MUSICALES', 'ARTES MUSICALES', 'A', 'C', 1, 'A', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T35', 4),
    ('A', 'FACULTAD DE ARTES', 'FAC. DE ARTES', 1, 9, 'A17', 'ARQ', 'ARQUITECTURA', 'ARQUITECTURA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q61', 5),
    ('G', 'FACULTAD DE INGENIERIA', 'FAC. DE ING.', 7, 144, 'G15', 'CCV', 'TUS. CONSTRUCCIONES CIVILES', 'TUS. CONSTRUCCIONES CIVILES', 'S', 'C', 1, 'A', 'C', 'TUS', 3, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q59', 6),
    ('F', 'FACULTAD DE DERECHO', 'FAC. DE DERECHO', 6, 135, 'F15', 'CDE', 'DERECHO - UNCIA', 'DERECHO - UNCIA', 'A', 'S', 5, 'A', 'C', 'LIC', 4, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T15', 7),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 54, 'C27', 'CEC', 'ECONOMIA - UNCIA', 'ECONOMIA - UNCIA', 'S', 'S', 5, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U27', 8),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 81, 'D18', 'CIN', 'PROGRAMA INGENIERIA INFORMATICA - UNCIA', 'PROG. ING. INFORMATICA - UNCIA', 'S', 'S', 5, 'B', 'P', 'LIC', NULL, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q48', 9),
    ('G', 'FACULTAD DE INGENIERIA', 'FAC. DE ING.', 7, 138, 'G11', 'CIV', 'INGENIERIA CIVIL', 'ING. CIVIL', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q55', 10),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 102, 'E17', 'CLI', 'PROGRAMA LINGUISTICA E IDIOMAS - UNCIA', 'PROG. LINGUISTICA E IDIOMAS - UNCIA', 'A', 'S', 5, 'B', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T21', 11),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 93, 'E11', 'COM', 'CIENCIAS DE LA COMUNICACION', 'CIENCIAS DE LA COMUNICACION', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T31', 12),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 33, 'C13', 'COP', 'AUDITORIA - CONTADURIA PUBLICA', 'AUDITORIA - CONTADURIA PUBLICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U13', 13),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 45, 'C21', 'CTB', 'CONTABILIDAD Y FINANZAS', 'CONTABILIDAD Y FINANZAS', 'S', 'C', 1, 'A', 'C', 'LIC', 4, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U21', 14),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 108, 'E21', 'CTS', 'TRABAJO SOCIAL - UNCIA', 'TRABAJO SOCIAL - UNCIA', 'A', 'S', 5, 'A', 'C', 'LIC', 4, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T25', 15),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 39, 'C17', 'CTT', 'CONTADURIA PUBLICA - TUPIZA', 'CONTADURIA PUBLICA - TUPIZA', 'S', 'S', 4, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U17', 16),
    ('F', 'FACULTAD DE DERECHO', 'FAC. DE DERECHO', 6, 129, 'F11', 'DER', 'DERECHO', 'DERECHO', 'A', 'C', 1, 'A', 'C', 'LIC', 4, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T11', 17),
    ('F', 'FACULTAD DE DERECHO', 'FAC. DE DERECHO', 6, 132, 'F13', 'DET', 'DERECHO - TUPIZA', 'DERECHO - TUPIZA', 'A', 'S', 4, 'A', 'P', 'LIC', 4, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T13', 18),
    ('M', 'VICERRECTORADO', 'VICERRECTORADO', 13, 249, 'M13', 'DPD', 'INGENIERIA EN DISEÑO Y PROGRAMACION DIGITAL', 'ING. EN DISEÑO Y PROG. DIGITAL', 'S', 'C', 1, 'A', 'P', 'LIC', 4, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q51', 19),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 51, 'C25', 'ECO', 'ECONOMIA', 'ECONOMIA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U25', 20),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 123, 'E33', 'EDI', 'ESCUELA DE IDIOMAS', 'ESCUELA DE IDIOMAS', 'S', 'C', 1, 'A', NULL, 'TUM', NULL, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', NULL, 21),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 126, 'E34', 'EDT', 'ESCUELA DE IDIOMAS - TUPIZA', 'ESCUELA DE IDIOMAS - TUPIZA', 'S', 'S', 4, 'A', NULL, 'TUM', NULL, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', NULL, 22),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 165, 'J11', 'ELE', 'INGENIERIA ELECTRICA', 'ING. ELECTRICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q19', 23),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 219, 'K11', 'ENF', 'ENFERMERIA', 'ENFERMERIA', 'A', 'C', 1, 'A', 'C', 'LIC', 5, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S11', 24),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 66, 'D11', 'EST', 'ESTADISTICA', 'ESTADISTICA', 'S', 'C', 1, 'A', 'C', 'LIC', 4, 'CPN', 'CIENCIAS PURAS Y NATURALES', 'CIENCIAS PURAS Y NATURALES', 'A', 'P11', 25),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 120, 'E32', 'EXI', 'EXTENSION LIBRE - INGLES', 'EXT. LIBRE - INGLES', 'S', 'C', 1, 'A', NULL, 'TUM', NULL, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', NULL, 26),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 117, 'E31', 'EXQ', 'EXTENSION LIBRE - QUECHUA', 'EXT. LIBRE - QUECHUA', 'S', 'C', 1, 'A', NULL, 'TUM', NULL, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', NULL, 27),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 69, 'D13', 'FIS', 'FISICA', 'FISICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CPN', 'CIENCIAS PURAS Y NATURALES', 'CIENCIAS PURAS Y NATURALES', 'A', 'P13', 28),
    ('G', 'FACULTAD DE INGENIERIA', 'FAC. DE ING.', 7, 141, 'G13', 'GYT', 'ING. EN GEODESIA Y TOPOGRAFIA', 'ING. EN GEODESIA Y TOPOGRAFIA', 'A', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q57', 29),
    ('B', 'FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS', 'FAC. DE CC AA Y PP', 2, 15, 'B13', 'IAI', 'INGENIERIA AGROINDUSTRIAL', 'ING. AGROINDUSTRIAL', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CAFP', 'CIENCIAS AGRICOLAS FORESTALES y PECUARIAS', 'CC., AGRIC., FOR. y PEC.', 'C', 'R13', 30),
    ('H', 'FACULTAD DE INGENIERIA GEOLOGICA', 'FAC. DE ING. GEOLOGICA', 8, 150, 'H12', 'IAM', 'INGENERIA AMBIENTAL', 'ING. AMBIENTAL', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q12', 31),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 60, 'C31', 'ICO', 'INGENIERIA COMERCIAL', 'ING. COMERCIAL', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U31', 32),
    ('B', 'FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS', 'FAC. DE CC AA Y PP', 2, 18, 'B15', 'IDR', 'INGENIERIA EN DESARROLLO RURAL', 'ING. EN DESARROLLO RURAL', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CAFP', 'CIENCIAS AGRICOLAS FORESTALES y PECUARIAS', 'CC., AGRIC., FOR. y PEC.', 'C', 'R15', 33),
    ('B', 'FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS', 'FAC. DE CC AA Y PP', 2, 21, 'B16', 'IDT', 'INGENIERIA EN DESARROLLO TERRITORIAL', 'ING. EN DESARROLLO TERRITORIAL', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CAFP', 'CIENCIAS AGRICOLAS FORESTALES y PECUARIAS', 'CC., AGRIC., FOR. y PEC.', 'C', 'R16', 34),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 177, 'J17', 'IET', 'INGENIERIA ELECTRONICA', 'ING. ELECTRONICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q25', 35),
    ('H', 'FACULTAD DE INGENIERIA GEOLOGICA', 'FAC. DE ING. GEOLOGICA', 8, 147, 'H11', 'IGO', 'INGENIERIA GEOLOGICA', 'ING. GEOLOGICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q11', 36),
    ('H', 'FACULTAD DE INGENIERIA GEOLOGICA', 'FAC. DE ING. GEOLOGICA', 8, 153, 'H13', 'IMA', 'INGENIERIA DEL MEDIO AMBIENTE', 'ING. DEL MEDIO AMBIENTE', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q13', 37),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 189, 'J23', 'IMC', 'INGENIERIA MECANICA', 'ING. MECANICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q31', 38),
    ('I', 'FACULTAD DE INGENIERIA MINERA', 'FAC. DE ING. MINERA', 9, 156, 'I11', 'IMI', 'INGENIERIA MINERA', 'ING. MINERA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q15', 39),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 201, 'J29', 'IMT', 'INGENIERIA MECATRONICA', 'ING. MECATRONICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q37', 40),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 186, 'J22', 'IND', 'INGENIERIA INDUSTRIAL', 'ING. INDUSTRIAL', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q30', 41),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 72, 'D15', 'INF', 'INGENIERIA INFORMATICA', 'ING. INFORMATICA', 'S', 'C', 1, 'A', 'C', 'LIC', 4, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q45', 42),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 43, 'C20', 'LAT', 'LICENCIATURA EN AUTORIA - TUPIZA', 'LICENCIATURA EN AUTORIA - TUPIZA', 'S', 'S', 4, 'B', 'P', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U20', 43),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 228, 'K15', 'LEF', 'TEC. MEDIO ENFERMERIA - LLICA', 'TEC. MEDIO ENFERMERIA - LLICA', 'A', 'S', 2, 'A', 'P', 'TUM', 2, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S17', 44),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 96, 'E13', 'LEI', 'LINGUISTICA E IDIOMAS', 'LINGUISTICA E IDIOMAS', 'A', 'C', 1, 'A', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T17', 45),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 213, 'J36', 'LMA', 'TEC. MEDIO MECANICA AUTOMOTRIZ - LLICA', 'TEC. MEDIO MECANICA AUTOMOTRIZ - LLICA', 'S', 'S', 2, 'A', 'P', 'TUM', 2, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q44', 46),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 84, 'D19', 'MAT', 'MATEMATICA', 'MATEMATICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CPN', 'CIENCIAS PURAS Y NATURALES', 'CIENCIAS PURAS Y NATURALES', 'A', 'P15', 47),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 207, 'J33', 'MAU', 'TUS. EN MECANICA AUTOMOTRIZ', 'TUS. EN MECANICA AUTOMOTRIZ', 'S', 'C', 1, 'A', 'C', 'TUS', 3, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q41', 48),
    ('L', 'FACULTAD DE MEDICINA', 'FAC. DE MEDICINA', 12, 243, 'L11', 'MED', 'MEDICINA', 'MEDICINA', 'A', 'C', 1, 'A', 'C', 'LIC', 6, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S27', 49),
    ('I', 'FACULTAD DE INGENIERIA MINERA', 'FAC. DE ING. MINERA', 9, 159, 'I12', 'MIN', 'INGENIERIA DE MINAS', 'ING. DE MINAS', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q16', 50),
    ('B', 'FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS', 'FAC. DE CC AA Y PP', 2, 27, 'B19', 'MVZ', 'MED. VETERINARIA Y ZOOTECNIA - TUPIZA', 'MED. VETERINARIA Y ZOOTECNIA - TUPIZA', 'S', 'S', 4, 'A', 'C', 'LIC', 5, 'CAFP', 'CIENCIAS AGRICOLAS FORESTALES y PECUARIAS', 'CC., AGRIC., FOR. y PEC.', 'C', 'R19', 51),
    ('M', 'VICERRECTORADO', 'VICERRECTORADO', 13, 255, 'M17', 'ODO', 'ODONTOLOGIA', 'ODONTOLOGIA', 'A', 'C', 1, 'A', 'C', 'LIC', 5, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S29', 52),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 225, 'K13', 'PEN', 'PROG. DE AUXILIARES DE ENFERMERIA', 'PROG. DE AUX. DE ENFERMERIA', 'A', 'C', 1, 'A', 'P', 'TUM', 2, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S15', 53),
    ('M', 'VICERRECTORADO', 'VICERRECTORADO', 13, 258, 'M19', 'PIC', 'PROGRAMA DE PEDAGOGIA INTERCULTURAL', 'PROG. DE PEDAGOGIA INTERCULTURAL', 'A', 'C', 1, 'B', 'P', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T37', 54),
    ('I', 'FACULTAD DE INGENIERIA MINERA', 'FAC. DE ING. MINERA', 9, 162, 'I13', 'PMM', 'ING. DE PROCESOS DE MAT. PRIMAS MIN.', 'ING. DE PROCESOS DE MAT. PRIMAS MIN.', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q17', 55),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 87, 'D21', 'QMC', 'QUIMICA', 'QUIMICA', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CPN', 'CIENCIAS PURAS Y NATURALES', 'CIENCIAS PURAS Y NATURALES', 'A', 'P17', 56),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 90, 'D3', 'QUI', 'QUIMICA - UYUNI', 'QUIMICA - UYUNI', 'S', 'S', 6, 'A', 'C', 'LIC', 5, 'CPN', 'CIENCIAS PURAS Y NATURALES', 'CIENCIAS PURAS Y NATURALES', 'A', 'P19', 57),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 231, 'K17', 'SEN', 'ENFERMERIA - SACACA', 'ENFERMERIA - SACACA', 'A', 'S', 3, 'B', 'P', 'LIC', 5, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S19', 58),
    ('M', 'VICERRECTORADO', 'VICERRECTORADO', 13, 246, 'M11', 'SIS', 'INGENIERIA DE SISTEMAS', 'ING. DE SISTEMAS', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q49', 59),
    ('M', 'VICERRECTORADO', 'VICERRECTORADO', 13, 252, 'M15', 'SIT', 'INGENIERIA DE SISTEMAS - TUPIZA', 'ING. DE SISTEMAS - TUPIZA', 'S', 'S', 4, 'A', 'P', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q53', 60),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 36, 'C15', 'TAS', 'TUS EN CONTABILIDAD', 'TUS EN CONTABILIDAD', 'S', 'C', 1, 'B', 'C', 'TUS', 3, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U15', 61),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 105, 'E19', 'TCS', 'TRABAJO SOCIAL', 'TRABAJO SOCIAL', 'S', 'C', 1, 'A', 'C', 'LIC', 4, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T23', 62),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 183, 'J21', 'TEA', 'TEC. MEDIO ELECTRONICA', 'TEC. MEDIO ELECTRONICA', 'S', 'C', 1, 'A', 'C', 'TUM', 2, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q29', 63),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 171, 'J15', 'TED', 'TEC. MEDIO ELECTRICIDAD', 'TEC. MEDIO ELECTRICIDAD', 'S', 'C', 1, 'A', 'C', 'TUM', 2, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q23', 64),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 210, 'J35', 'TMA', 'TEC. MEDIO MECANICA AUTOMOTRIZ', 'TEC. MEDIO MECANICA AUTOMOTRIZ', 'S', 'C', 1, 'A', 'C', 'TUM', 2, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q43', 65),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 204, 'J31', 'TMC', 'TUS. EN MECATRONICA', 'TUS. EN MECATRONICA', 'S', 'C', 1, 'B', 'C', 'TUS', 3, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q39', 66),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 222, 'K12', 'TMF', 'TEC. MEDIO ENFERMERIA', 'TEC. MEDIO ENFERMERIA', 'A', 'C', 1, 'A', 'C', 'TUM', 2, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S13', 67),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 195, 'J27', 'TMG', 'TEC. MEDIO MECANICA GENERAL', 'TEC. MEDIO MECANICA GENERAL', 'S', 'C', 1, 'A', 'C', 'TUM', 2, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q35', 68),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 216, 'J33', 'TSA', 'TUS. EN MECANICA AUTOMOTRIZ - SAN CRISTOBAL', 'TUS. EN MECANICA AUTOMOTRIZ - SAN CRISTOBAL', 'S', 'S', 8, 'A', 'P', 'TUS', 3, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q45', 69),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 48, 'C23', 'TSC', 'TUS. CONTADOR GENERAL', 'TUS. CONTADOR GENERAL', 'S', 'C', 1, 'B', 'C', 'TUS', 3, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U23', 70),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 174, 'J16', 'TSE', 'INGENIERIA ELECTRICA - SAN CRISTOBAL', 'ING. ELECTRICA - SAN CRISTOBAL', 'S', 'S', 8, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q24', 71),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 198, 'J28', 'TSM', 'INGENIERIA MECANICA - SAN CRISTOBAL', 'ING. MECANICA - SAN CRISTOBAL', 'S', 'S', 8, 'A', 'C', 'LIC', 5, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q36', 72),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 75, 'D16', 'TSR', 'ING. INFORMATICA - TECNICO SUPERIOR EN REDES Y CIBERSEGURIDAD', 'ING. INFORMATICA - TUS EN REDES Y CIBERSEGURIDAD', 'S', 'C', 1, 'A', 'P', 'TUS', NULL, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q46', 73),
    ('D', 'FACULTAD DE CIENCIAS PURAS', 'FAC. DE CIENCIAS PURAS', 4, 78, 'D17', 'TSS', 'ING. INFORMATICA - TECNICO SUPERIOR EN SISTEMAS INFORMATICOS', 'ING. INFORMATICA - TUS EN SISTEMAS INFORMATICOS', 'S', 'C', 1, 'A', 'P', 'TUS', NULL, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q47', 74),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 168, 'J13', 'TUE', 'TUS. ELECTRICIDAD', 'TUS. ELECTRICIDAD', 'S', 'C', 1, 'B', 'C', 'TUS', 3, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q21', 75),
    ('J', 'FACULTAD DE INGENIERIA TECNOLOGICA', 'FAC. DE ING. TECNOLOGICA', 10, 192, 'J25', 'TUM', 'TUS. EN MECANICA GENERAL', 'TUS. EN MECANICA GENERAL', 'S', 'C', 1, 'B', 'C', 'TUS', 3, 'ITC', 'INGENIERIA TECNOLOGIA y CONSTRUCCIONES', 'ING. TECNOLOGIA y CONSTRUCCIONES', 'B', 'Q33', 76),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 111, 'E23', 'TUR', 'TURISMO', 'TURISMO', 'S', 'C', 1, 'A', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T27', 77),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 114, 'E25', 'TUU', 'TURISMO - UYUNI', 'TURISMO - UYUNI', 'S', 'S', 6, 'A', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T29', 78),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 57, 'C29', 'UEC', 'ECONOMIA - UYUNI', 'ECONOMIA - UYUNI', 'S', 'S', 6, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U29', 79),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 234, 'K19', 'UEN', 'ENFERMERIA - UYUNI', 'ENFERMERIA - UYUNI', 'A', 'S', 6, 'B', 'P', 'LIC', 5, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S21', 80),
    ('E', 'FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS', 'FAC. DE CC SS Y HH', 5, 99, 'E15', 'ULI', 'LINGUISTICA E IDIOMAS - UYUNI', 'LINGUISTICA E IDIOMAS - UYUNI', 'A', 'S', 6, 'A', 'C', 'LIC', 5, 'CJSAH', 'CIENCIAS JURIDICAS, SOCIALES, ARTES Y HUMANIDADES', 'CC., JUR., SOC., ART. y HUM.', 'E', 'T19', 81),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 237, 'K21', 'UTE', 'TEC. MEDIO ENFERMERIA - UYUNI', 'TEC. MEDIO ENFERMERIA - UYUNI', 'A', 'S', 6, 'B', 'P', 'TUM', 2, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S23', 82),
    ('B', 'FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS', 'FAC. DE CC AA Y PP', 2, 24, 'B17', 'VAG', 'INGENIERIA AGROPECUARIA - VILLAZON', 'ING. AGROPECUARIA - VILLAZON', 'S', 'S', 7, 'A', 'C', 'LIC', 5, 'CAFP', 'CIENCIAS AGRICOLAS FORESTALES y PECUARIAS', 'CC., AGRIC., FOR. y PEC.', 'C', 'R17', 83),
    ('C', 'FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS', 'FAC. DE CC EE FF Y AA', 3, 63, 'C33', 'VCI', 'COMERCIO INTERNACIONAL - VILLAZON', 'COMERCIO INTERNACIONAL - VILLAZON', 'S', 'S', 7, 'A', 'C', 'LIC', 5, 'CEAFC', 'CIENCIAS ECONOMICAS, ADMINISTRATIVAS, FINANCIERAS y COMERCIALES', 'CC., ECO., ADM., FIN., y COM.', 'F', 'U33', 84),
    ('K', 'FACULTAD DE CIENCIAS DE LA SALUD', 'FAC. DE CIENCIAS DE LA SALUD', 11, 240, 'K23', 'VEF', 'ENFERMERIA - VILLAZON', 'ENFERMERIA - VILLAZON', 'A', 'S', 7, 'A', 'C', 'LIC', 5, 'CCSS', 'CIENCIAS DE LA SALUD', 'CIENCIAS DE LA SALUD', 'D', 'S25', 85);

DO $$
BEGIN
    IF (SELECT count(*) FROM _dw_test_faculty) <> 13 OR
       (SELECT count(*) FROM _dw_test_program) <> 85 OR
       (SELECT count(*) FROM _dw_test_program WHERE schedule_code='A') <> 21 OR
       (SELECT count(*) FROM _dw_test_program WHERE schedule_code='S') <> 64 THEN
        RAISE EXCEPTION 'Embedded catalog failed its source audit assertions';
    END IF;
    IF EXISTS (SELECT 1 FROM _dw_test_program WHERE length(trim(program_code)) <> 3 OR study_years < 1 OR study_years > 8) THEN
        RAISE EXCEPTION 'Invalid synthetic catalog key/duration';
    END IF;
END $$;

-- Minimal synthetic geographic dimension needed to exercise the approved student joins.
INSERT INTO public.prs_pais_v2 (id_pais, pais, estado)
VALUES (30000, 'DW TEST PAIS', 'A');
INSERT INTO public.lugar_departamento (cod_dep, departamento, cod_pais)
VALUES (30000, 'DW TEST DEP', 30000);
INSERT INTO public.lugar_provincia (cod_dep, cod_prov_original, provincia, cod_pais, cod_prov)
VALUES
    (30000, 1, 'DW TEST PROV 1', 30000, 30001),
    (30000, 2, 'DW TEST PROV 2', 30000, 30002),
    (30000, 3, 'DW TEST PROV 3', 30000, 30003);
INSERT INTO public.lugar_localidad (cod_loc, cod_prov_original, cod_prov, cod_dep, cod_pais, localidad)
VALUES
    (30000, 1, 30001, 30000, 30000, 'DW TEST LOCALIDAD 1'),
    (30001, 1, 30001, 30000, 30000, 'DW TEST LOCALIDAD 2'),
    (30002, 2, 30002, 30000, 30000, 'DW TEST LOCALIDAD 3'),
    (30003, 2, 30002, 30000, 30000, 'DW TEST LOCALIDAD 4'),
    (30004, 3, 30003, 30000, 30000, 'DW TEST LOCALIDAD 5');
INSERT INTO public.prs_colegios (
    id_colegio_original, colegio, tipo, turno, area, cod_dep, cod_prov,
    cod_loc, cod_prov_2, id_pais, _estado, id_colegio
)
VALUES
    (30000, 'DW TEST COLEGIO 1', 'F', 'D', 'U', 30000, 30001, 30000, 0, 30000, 'A', 30000),
    (30001, 'DW TEST COLEGIO 2', 'F', 'D', 'U', 30000, 30002, 30002, 0, 30000, 'A', 30001),
    (30002, 'DW TEST COLEGIO 3', 'F', 'D', 'U', 30000, 30003, 30004, 0, 30000, 'A', 30002);
INSERT INTO public._bp_estados_civiles (id_estado_civil, cod_estado_civil, estado_civil, _id_usuario, _estado)
VALUES (32000, 'TST', 'DW TEST - NO INFORMADO', 'DW_TEST_SEED', 'A');

INSERT INTO academico.alm_programas_facultades (id_facultad, facultad, facu_abre, estado)
SELECT (30000 + ascii(source_code) - ascii('A') + 1)::integer,
       faculty_name, faculty_abbreviation, 'A'
FROM _dw_test_faculty;
INSERT INTO academico.carreras_tipos (tipo, descripcion)
VALUES ('C', 'DW TEST - carrera'), ('P', 'DW TEST - programa');
INSERT INTO academico.alumnos_estados (estado, descripcion)
VALUES ('A', 'DW TEST - estado sintético; semántica no certificada');

INSERT INTO academico.alm_programas (
    id_programa, programa, id_facultad, id_nivel, titulo, activo, nivel,
    tipo, tiempo_estudio, sede, _tipo_academico
)
SELECT p.program_code,
       p.program_name,
       (30000 + ascii(p.source_code) - ascii('A') + 1)::smallint,
       CASE p.academic_level WHEN 'LIC' THEN 1 WHEN 'TUS' THEN 2 WHEN 'TUM' THEN 3 END,
       CASE p.academic_level WHEN 'LIC' THEN 'LICENCIATURA'
            WHEN 'TUS' THEN 'TECNICO SUPERIOR' ELSE 'TECNICO MEDIO' END,
       CASE
           WHEN p.program_rank % 43 = 0 THEN 'X' -- synthetic unknown source-domain case
           WHEN p.program_rank % 31 = 0 THEN 'S' -- synthetic contract-path case
           WHEN p.program_rank % 31 = 1 THEN 'Y' -- synthetic contract-path case
           WHEN p.program_rank % 31 = 2 THEN '1' -- synthetic contract-path case
           ELSE p.active_code -- preserve raw A/B source-profile values; never normalize them
       END,
       p.academic_level,
       p.program_kind,
       p.study_years,
       NULL,
       'CAR'
FROM _dw_test_program p;

-- The legacy denormalized catalog is the only DDL table with tipo_c (A/S).
-- It is seeded for source-side calendar tests only; it is not in DW-001's allowlist.
INSERT INTO public.fac_programas (
    orden4, id_facultad, facultad_completo, facultad, orden5, orden, id_programa,
    programa2, programa, tipo_c, lugar, id_sede, activo, tipo, nivel,
    c_area, area_conoc2, area_conoc, orden3, orden2, tiempo_estudio
)
SELECT orden4, source_code::text, faculty_name, faculty_abbreviation,
       orden5, orden, program_code::text, program_name_variant, program_name,
       schedule_code::text, campus_label, campus_source_id, active_code, program_kind,
       academic_level, area_code, area_code_2, area_name, orden3, orden2, study_years
FROM _dw_test_program;

-- Synthetic instructors satisfy the real DCT foreign key without reusing
-- production identities or storing personal data.
INSERT INTO academico.docentes (
    id_docente, nombres, clave, estado, id_programa, _estado, modalidad
)
SELECT (130000000 + program_rank)::integer,
       ('DOCENTE TEST ' || lpad(program_rank::text, 3, '0'))::varchar(25),
       ('DW_TEST_TEACHER_' || lpad(program_rank::text, 3, '0'))::varchar(50),
       'A', program_code, 'DW_TEST_SEED', ''
FROM _dw_test_program;

-- Subject IDs are deterministic, remain inside smallint range for notas_planilla.id_materia,
-- and are namespaced with _obs. Missing catalog durations remain NULL above; only the
-- synthetic curriculum uses 3 years as a documented fixture fallback.
INSERT INTO academico.pln_materias (
    id_materia, sigla, materia, ciclo, id_programa, nivel_academico,
    _estado, nota_minima, _obs, _creditos
)
SELECT (1000 + p.program_rank * 300 + cycle_no * 8 + subject_no)::integer,
       ('T' || lpad(p.program_rank::text, 3, '0') || lpad(cycle_no::text, 2, '0') || subject_no::text)::char(7),
       ('DW TEST ' || trim(p.program_code) || ' - CICLO ' || lpad(cycle_no::text,2,'0') || ' - ASIGNATURA ' || subject_no)::varchar,
       cycle_no,
       p.program_code,
       CASE p.academic_level WHEN 'LIC' THEN 1 WHEN 'TUS' THEN 2 WHEN 'TUM' THEN 3 END,
       'REGISTRADO', 51, 'DW_TEST_SEED_V2', 0
FROM _dw_test_program p
CROSS JOIN LATERAL generate_series(
    1,
    COALESCE(p.study_years, 3) * CASE p.schedule_code WHEN 'S' THEN 2 ELSE 1 END
) AS cycle_no
CROSS JOIN generate_series(1, 4) AS subject_no;

CREATE TEMP TABLE _dw_test_people ON COMMIT DROP AS
SELECT person_no,
       ('TEST' || lpad(person_no::text, 6, '0'))::varchar(10) AS id_ra,
       p.program_code,
       p.program_rank,
       p.schedule_code,
       COALESCE(p.study_years, 3)::integer AS study_years,
       (2000 + (((person_no - 1) * 17) % 26))::smallint AS first_gestion,
       CASE WHEN p.schedule_code='A' THEN 1 ELSE 1 + (person_no % 2) END::smallint AS first_period,
       (person_no % 4 <> 0) AS first_application_admitted
FROM generate_series(1, 6000) AS person_no
JOIN _dw_test_program p ON p.program_rank = 1 + ((person_no - 1) % 85);

INSERT INTO public.uatf_datos (
    id_ra, nac_pais, id_dep, id_prov_original, id_loc, id_colegio,
    id_calificacion, estado_civil, _id_usuario, _modificado, nacionalidad
)
SELECT id_ra, 30000, 30000,
       (1 + ((person_no - 1) % 3))::smallint,
       (30000 + ((person_no - 1) % 5))::smallint,
       (30000 + ((person_no - 1) % 3))::smallint,
       NULL, 32000, 'DW_TEST_SEED',
       make_timestamp(first_gestion::integer, 1 + ((person_no - 1) % 12), 15, 8, 0, 0),
       NULL
FROM _dw_test_people;

-- One primary application per synthetic person and a second attempt for each seventh person.
WITH application_rows AS (
    SELECT p.*, 0 AS attempt_no, p.program_code AS attempt_program,
           p.schedule_code AS attempt_schedule,
           p.first_gestion::integer AS attempt_gestion,
           p.first_period::integer AS attempt_period,
           p.first_application_admitted AS admitted
    FROM _dw_test_people p
    UNION ALL
    SELECT p.*, 1 AS attempt_no,
           p2.program_code AS attempt_program,
           p2.schedule_code AS attempt_schedule,
           LEAST(p.first_gestion::integer + 1, 2025) AS attempt_gestion,
           CASE WHEN p2.schedule_code='A' THEN 1 ELSE 1 + ((p.person_no + 1) % 2) END AS attempt_period,
           (NOT p.first_application_admitted AND p.person_no % 3 <> 0) AS admitted
    FROM _dw_test_people p
    JOIN _dw_test_program p2 ON p2.program_rank = 1 + ((p.program_rank + 12) % 85)
    WHERE p.person_no % 7 = 0
), scored AS (
    SELECT a.*,
           (35 + ((a.person_no * 19 + a.attempt_no * 23) % 66))::integer AS score
    FROM application_rows a
)
INSERT INTO public.postulantes (
    id_programa, id_ra, fec_inscripcion, hora, id_grado, estado,
    promedio, examen, id_periodo, id_gestion, nota, _estado,
    _id_usuario, _modificado
)
SELECT attempt_program, id_ra,
       make_date(attempt_gestion, CASE WHEN attempt_period=1 THEN 3 ELSE 8 END, 1),
       make_timestamp(attempt_gestion, CASE WHEN attempt_period=1 THEN 3 ELSE 8 END, 1, 8, 0, 0)::timestamptz,
       'A', CASE WHEN person_no % 997 = 1 THEN 'B'
                 WHEN person_no % 997 = 2 THEN 'X'
                 WHEN admitted THEN 'A' ELSE 'P' END,
       score::numeric(6,2), score, attempt_period, attempt_gestion, score,
       'A', 'DWTEST_V2',
       make_timestamp(attempt_gestion, CASE WHEN attempt_period=1 THEN 3 ELSE 8 END, 1, 8, 0, 0)
FROM scored;

-- A subset of admitted applicants enrolls. No graduation/egress is fabricated.
INSERT INTO academico.alumnos (
    id_programa, id_ra, fec_inscripcion, fec_egreso, id_plan,
    id_grado, estado, tipo_alumno, _id_usuario_r, ssu, _fecha_registro
)
SELECT p.program_code,
       p.id_ra,
       make_date(p.first_gestion::integer, CASE WHEN p.first_period=1 THEN 3 ELSE 8 END, 1),
       NULL, NULL, 'A', 'A', 'A', 'DW_TEST_SEED', 'S',
       make_timestamp(p.first_gestion::integer, CASE WHEN p.first_period=1 THEN 3 ELSE 8 END, 1, 8, 0, 0)
FROM _dw_test_people p
WHERE p.first_application_admitted AND p.person_no % 13 <> 0;

CREATE TEMP TABLE _dw_test_students ON COMMIT DROP AS
SELECT p.person_no, p.id_ra, p.program_code, p.program_rank,
       p.schedule_code, p.study_years, p.first_gestion::integer AS first_gestion,
       p.first_period::integer AS first_period, a.id_alumno
FROM _dw_test_people p
JOIN academico.alumnos a ON a.id_ra=p.id_ra AND a.id_programa=p.program_code;

-- Build deterministic course attempts, with a small marked set for 0/1 partial attendance.
CREATE TEMP TABLE _dw_test_attempts ON COMMIT DROP AS
WITH terms AS (
    SELECT s.*, y.year_offset,
           s.first_gestion + y.year_offset AS gestion,
           period_slot,
           period_slot AS period_no,
           CASE WHEN s.schedule_code='A' THEN y.year_offset + 1
                ELSE y.year_offset * 2 + period_slot - s.first_period + 1 END AS cycle_no
    FROM _dw_test_students s
    CROSS JOIN LATERAL generate_series(0, 5) AS y(year_offset)
    CROSS JOIN LATERAL generate_series(1, CASE WHEN s.schedule_code='A' THEN 1 ELSE 2 END) AS period_slot
    WHERE y.year_offset < s.study_years
      AND s.first_gestion + y.year_offset <= 2025
      AND (y.year_offset > 0 OR period_slot >= s.first_period)
), scheduled AS (
    SELECT t.*, subject_no,
           (1000 + t.program_rank * 300 + t.cycle_no * 8 + subject_no)::smallint AS id_materia,
           CASE
             WHEN t.year_offset=0 AND t.period_no=t.first_period AND subject_no=1
                  AND t.person_no % 200=1 THEN 0
             WHEN t.year_offset=0 AND t.period_no=t.first_period AND subject_no=1
                  AND t.person_no % 200=101 THEN 1
             ELSE 2 + ((t.person_no + t.cycle_no + subject_no) % 3)
           END AS partial_count
    FROM terms t CROSS JOIN generate_series(1,4) AS subject_no
), marked AS (
    SELECT s.*,
           CASE WHEN partial_count < 2 THEN NULL::numeric
                ELSE (35 + ((person_no * 13 + cycle_no * 7 + subject_no * 17) % 66))::numeric END AS final_grade,
           CASE WHEN partial_count < 2 THEN 'X'::char(1)
                WHEN (35 + ((person_no * 13 + cycle_no * 7 + subject_no * 17) % 66)) >= 51 THEN 'A'::char(1)
                ELSE 'R'::char(1) END AS raw_status
    FROM scheduled s
)
SELECT person_no, id_alumno, program_code, program_rank, gestion::smallint AS gestion,
       period_no::smallint AS periodo, cycle_no, subject_no, id_materia,
       (1 + ((person_no + cycle_no + subject_no) % 6))::smallint AS grupo,
       final_grade, raw_status, partial_count,
       CASE WHEN partial_count >= 1 THEN (1 + ((person_no * 5 + cycle_no * 11 + subject_no * 3) % 100))::numeric END AS pparcial,
       CASE WHEN partial_count >= 2 THEN (1 + ((person_no * 7 + cycle_no * 13 + subject_no * 5) % 100))::numeric END AS sparcial,
       CASE WHEN partial_count >= 3 THEN (1 + ((person_no * 11 + cycle_no * 17 + subject_no * 7) % 100))::numeric END AS tparcial,
       CASE WHEN partial_count >= 4 THEN (1 + ((person_no * 13 + cycle_no * 19 + subject_no * 9) % 100))::numeric END AS cparcial,
       CASE WHEN partial_count < 2 THEN 'DW_TEST_SEED_V2:abandono_lt2_parciales_' || partial_count
            ELSE 'DW_TEST_SEED_V2:normal' END AS observacion
FROM marked;

INSERT INTO academico.notas_planilla (
    id_matricula, id_gestion, id_periodo, id_alumno, id_materia, grupo, nota,
    ult_usuario, estado, observacion, nota_2da, nota_ex_mesa,
    pparcial, sparcial, tparcial, cparcial, tipo, _fecha_creacion, _hash
)
SELECT (100000000 + row_number() OVER (ORDER BY a.id_alumno, a.gestion, a.periodo, a.cycle_no, a.subject_no))::integer,
       a.gestion, a.periodo, a.id_alumno, a.id_materia, a.grupo, a.final_grade,
       'DW_TEST_SEED', a.raw_status, a.observacion,
       CASE WHEN a.final_grade IS NOT NULL AND a.final_grade < 51 AND a.person_no % 9=0
            THEN (51 + ((a.person_no + a.cycle_no) % 50))::numeric END,
       CASE WHEN a.final_grade IS NOT NULL AND a.final_grade < 51 AND a.person_no % 13=0
            THEN (51 + ((a.person_no + a.subject_no) % 50))::numeric END,
       a.pparcial, a.sparcial, a.tparcial, a.cparcial, 'N',
       make_timestamp(a.gestion::integer, CASE WHEN a.periodo=1 THEN 6 ELSE 11 END, 28, 23, 0, 0),
       'DWTESTV2'
FROM _dw_test_attempts a;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM academico.notas_planilla
        WHERE _hash = 'DWTESTV2' AND id_periodo <= 0
    ) THEN
        RAISE EXCEPTION 'Synthetic fact rows must use positive academic period codes supported by the DW';
    END IF;
    IF (SELECT count(DISTINCT id_gestion) FROM academico.notas_planilla WHERE _hash='DWTESTV2') <> 26
       OR (SELECT min(id_gestion) FROM academico.notas_planilla WHERE _hash='DWTESTV2') <> 2000
       OR (SELECT max(id_gestion) FROM academico.notas_planilla WHERE _hash='DWTESTV2') <> 2025 THEN
        RAISE EXCEPTION 'Synthetic course attempts must cover every gestion from 2000 through 2025';
    END IF;
END;
$$;

-- Repeat only a previously failed subject, as a separate later-period attempt.
INSERT INTO academico.notas_planilla (
    id_matricula, id_gestion, id_periodo, id_alumno, id_materia, grupo, nota,
    ult_usuario, estado, observacion, pparcial, sparcial, tipo,
    _fecha_creacion, _hash
)
SELECT (110000000 + row_number() OVER (ORDER BY current_attempt.id_alumno,
           current_attempt.gestion, current_attempt.periodo, current_attempt.cycle_no))::integer,
       current_attempt.gestion, current_attempt.periodo,
       current_attempt.id_alumno, prior_attempt.id_materia,
       current_attempt.grupo,
       (51 + ((current_attempt.person_no + current_attempt.cycle_no) % 50))::numeric,
       'DW_TEST_SEED', 'A', 'DW_TEST_SEED_V2:reintento',
       (51 + ((current_attempt.person_no + 3) % 50))::numeric,
       (51 + ((current_attempt.person_no + 7) % 50))::numeric,
       'N', make_timestamp(current_attempt.gestion::integer,
           CASE WHEN current_attempt.periodo=1 THEN 6 ELSE 11 END, 28, 23, 0, 0),
       'DWTESTV2'
FROM _dw_test_attempts current_attempt
JOIN _dw_test_attempts prior_attempt
  ON prior_attempt.id_alumno=current_attempt.id_alumno
 AND prior_attempt.cycle_no=current_attempt.cycle_no-1
 AND prior_attempt.subject_no=1
WHERE current_attempt.subject_no=1
  AND current_attempt.cycle_no > 1
  AND current_attempt.person_no % 11=0
  AND prior_attempt.final_grade IS NOT NULL
  AND prior_attempt.final_grade < 51;

-- Synthetic code catalogs deliberately carry no asserted temporal ordering or dates.
-- alm_periodos.id_periodo_relacion is populated only to satisfy its NOT NULL contract;
-- the self-link below is NOT a successor-period rule.
INSERT INTO academico.periodos (id_periodo, des_periodo, orden, tipo, certificado_des_periodo)
SELECT code,
       'DW TEST SYNTHETIC PERIOD CODE ' || code,
       NULL,
       NULL,
       NULL
FROM generate_series(0, 7) AS code;

INSERT INTO academico.alm_periodos (id_periodo, descripcion, id_periodo_relacion)
SELECT code, 'DW TEST SYNTHETIC PERIOD CODE ' || code, code
FROM generate_series(0, 7) AS code;

-- Mirror note attempts into the independent programming source. These are synthetic
-- registrations; the fixture does not claim all registrations must have a grade.
INSERT INTO academico.alm_programaciones (
    id_alumno, id_materia, id_gestion, id_periodo, id_grupo, fecha, ult_usuario,
    estado, pparcial, sparcial, tparcial, cparcial, nota, nota_2da,
    nota_ex_mesa, observacion, tipo_prog, metodo_programacion, _estado,
    tipo_programacion, fecha_creacion
)
SELECT n.id_alumno, n.id_materia, n.id_gestion, n.id_periodo, n.grupo,
       n._fecha_creacion, 'DW_TEST_SEED', 'A',
       COALESCE(n.pparcial, 0)::smallint,
       COALESCE(n.sparcial, 0)::smallint,
       COALESCE(n.tparcial, 0)::smallint,
       COALESCE(n.cparcial, 0)::smallint,
       COALESCE(n.nota, 0)::smallint,
       COALESCE(n.nota_2da, 0)::smallint,
       COALESCE(n.nota_ex_mesa, 0)::smallint,
       'R', 'N', 'DW_TEST_SYNTHETIC', 'REGISTRADO', 'NORMAL', n._fecha_creacion
FROM academico.notas_planilla n
WHERE n._hash = 'DWTESTV2';

-- Candidate period source fixture: one distinct assignment per program, subject,
-- group and cut represented in synthetic notes. No assignment implies no semester;
-- this dataset therefore includes only the generated workload's observed cuts.
-- Derive the groups from the in-memory generator instead of rescanning the large,
-- indexed OLTP notes table after insertion. Repeated failed subjects are included
-- as an assignment in the student's later cut.
INSERT INTO academico.dct_asignaciones (
    id_docente, id_programa, id_materia, id_grupo, id_gestion, id_periodo,
    fecha, estado, codse, tipo_calificacion, finalizar, se_elegido, cupo_max,
    id_dct_asignaciones, _estado, observacion
)
WITH repeated_assignments AS (
    SELECT current_attempt.program_code AS id_programa,
           prior_attempt.id_materia,
           current_attempt.grupo,
           current_attempt.gestion AS id_gestion,
           current_attempt.periodo AS id_periodo
    FROM _dw_test_attempts current_attempt
    JOIN _dw_test_attempts prior_attempt
      ON prior_attempt.id_alumno = current_attempt.id_alumno
     AND prior_attempt.cycle_no = current_attempt.cycle_no - 1
     AND prior_attempt.subject_no = 1
    WHERE current_attempt.subject_no = 1
      AND current_attempt.cycle_no > 1
      AND current_attempt.person_no % 11 = 0
      AND prior_attempt.final_grade IS NOT NULL
      AND prior_attempt.final_grade < 51
), assignment_groups AS (
    SELECT program_code AS id_programa, id_materia, grupo,
           gestion AS id_gestion, periodo AS id_periodo
    FROM _dw_test_attempts
    UNION
    SELECT id_programa, id_materia, grupo, id_gestion, id_periodo
    FROM repeated_assignments
)
SELECT (130000000 + p.program_rank)::integer,
       g.id_programa, g.id_materia, g.grupo, g.id_gestion, g.id_periodo,
       NULL, NULL, NULL, 'N', 'N', 'N', 0,
       (120000000 + row_number() OVER (
           ORDER BY g.id_gestion, g.id_periodo, g.id_programa, g.id_materia, g.grupo
       ))::integer,
       'A', 'DW_TEST_SYNTHETIC_ASSIGNMENT'
FROM assignment_groups g
JOIN _dw_test_program p ON p.program_code = g.id_programa;

-- No graduation, closure calendar, DW tables, or real-person attributes are written here.
COMMIT;

-- The fixture is bulk-loaded; refresh planner statistics before running Hop.
ANALYZE public.uatf_datos;
ANALYZE public.postulantes;
ANALYZE academico.alm_programas;
ANALYZE academico.docentes;
ANALYZE academico.pln_materias;
ANALYZE academico.alumnos;
ANALYZE academico.notas_planilla;
ANALYZE academico.alm_programaciones;
ANALYZE academico.dct_asignaciones;

SELECT 'historical synthetic seed committed' AS result,
       (SELECT count(*) FROM public.uatf_datos WHERE id_ra LIKE 'TEST%') AS synthetic_persons,
       (SELECT count(*) FROM public.postulantes WHERE _id_usuario='DWTEST_V2') AS applications,
       (SELECT count(*) FROM academico.alumnos WHERE id_ra LIKE 'TEST%') AS students,
       (SELECT count(*) FROM academico.notas_planilla WHERE observacion LIKE 'DW_TEST_SEED_V2:%') AS course_attempts,
       (SELECT count(*) FROM academico.alm_programas) AS synthetic_program_rows,
       (SELECT count(*) FROM public.fac_programas) AS program_schedule_rows,
       (SELECT count(*) FROM academico.pln_materias WHERE _obs='DW_TEST_SEED_V2') AS synthetic_subjects,
       (SELECT count(*) FROM academico.dct_asignaciones WHERE observacion='DW_TEST_SYNTHETIC_ASSIGNMENT') AS synthetic_dct_assignments,
       (SELECT count(*) FROM academico.alm_programaciones WHERE ult_usuario='DW_TEST_SEED') AS synthetic_programmings;
