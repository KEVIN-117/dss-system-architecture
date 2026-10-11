-- DW-006 integration test. All fixtures are rolled back.

BEGIN;

CREATE ROLE dw_dimension_untrusted_test NOLOGIN;

DO $$
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'dim_estudiante', 'dim_programa', 'dim_materia',
        'dim_periodo_academico', 'dim_admision'
    ] LOOP
        IF to_regclass(format('dw.%s', v_table)) IS NULL THEN
            RAISE EXCEPTION 'No existe la dimensión esperada: %', v_table;
        END IF;

        IF (SELECT pg_get_userbyid(relowner)
            FROM pg_class
            WHERE oid = to_regclass(format('dw.%s', v_table))) <> 'dw_owner' THEN
            RAISE EXCEPTION 'La dimensión % no pertenece a dw_owner', v_table;
        END IF;

        IF NOT has_table_privilege('dw_publisher', format('dw.%s', v_table), 'INSERT')
           OR NOT has_table_privilege('dw_publisher', format('dw.%s', v_table), 'UPDATE')
           OR NOT has_table_privilege('dw_publisher', format('dw.%s', v_table), 'DELETE')
           OR NOT has_table_privilege('dw_publisher', format('dw.%s', v_table), 'SELECT')
           OR NOT has_table_privilege('dw_reader', format('dw.%s', v_table), 'SELECT')
           OR NOT has_table_privilege('dw_ml_writer', format('dw.%s', v_table), 'SELECT')
           OR has_table_privilege('dw_reader', format('dw.%s', v_table), 'INSERT')
           OR has_table_privilege('dw_ml_writer', format('dw.%s', v_table), 'UPDATE')
           OR has_table_privilege('dw_transformer', format('dw.%s', v_table), 'SELECT')
           OR has_table_privilege('dw_staging_writer', format('dw.%s', v_table), 'SELECT')
           OR has_table_privilege('dw_control_operator', format('dw.%s', v_table), 'SELECT')
           OR has_table_privilege('dw_dimension_untrusted_test', format('dw.%s', v_table), 'SELECT') THEN
            RAISE EXCEPTION 'La matriz de privilegios es incorrecta para dw.%', v_table;
        END IF;
    END LOOP;

    IF has_schema_privilege('dw_transformer', 'dw', 'USAGE')
       OR has_schema_privilege('dw_staging_writer', 'dw', 'USAGE')
       OR has_schema_privilege('dw_control_operator', 'dw', 'USAGE')
       OR has_schema_privilege('dw_dimension_untrusted_test', 'dw', 'USAGE') THEN
        RAISE EXCEPTION 'Un rol no autorizado puede usar el esquema dw';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE table_schema = 'dw'
          AND table_name IN (
              'dim_estudiante', 'dim_programa', 'dim_materia',
              'dim_periodo_academico', 'dim_admision'
          )
          AND grantee = 'PUBLIC'
    ) THEN
        RAISE EXCEPTION 'PUBLIC tiene privilegios sobre dimensiones DW-006';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM etl_control.schema_migration
        WHERE version = '0004'
          AND filename = '0004_create_conformed_dimensions.sql'
    ) THEN
        RAISE EXCEPTION 'La migración DW-006 no fue registrada por el runner';
    END IF;

    IF (SELECT COUNT(*) FROM dw.dim_estudiante
        WHERE (estudiante_sk, member_type, technical_label) IN (
            (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica')
        )) <> 2
       OR (SELECT COUNT(*) FROM dw.dim_programa
           WHERE (programa_sk, member_type, technical_label) IN (
               (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica')
           )) <> 2
       OR (SELECT COUNT(*) FROM dw.dim_materia
           WHERE (materia_sk, member_type, technical_label) IN (
               (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica')
           )) <> 2
       OR (SELECT COUNT(*) FROM dw.dim_periodo_academico
           WHERE (periodo_academico_sk, member_type, technical_label) IN (
               (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica')
           )) <> 2
       OR (SELECT COUNT(*) FROM dw.dim_admision
           WHERE (admision_sk, member_type, technical_label) IN (
               (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica')
           )) <> 2 THEN
        RAISE EXCEPTION 'Faltan o fueron alterados miembros técnicos DW-006';
    END IF;
END;
$$;

SET LOCAL ROLE dw_staging_writer;
SELECT etl_control.create_etl_execution(
    '77777777-7777-7777-7777-777777777777'::uuid,
    'HISTORICA'::varchar(24),
    'load-manager:dw-006-test'::varchar(255)
);
RESET ROLE;

SET LOCAL ROLE dw_publisher;
INSERT INTO dw.dim_estudiante (
    member_type, id_ra, id_alumno, id_sexo, estado_civil,
    fec_inscripcion, estado_academico, tipo_alumno, source_run_id, attribute_hash_scd2,
    valid_from, is_current
) VALUES (
    'STANDARD', 'RA-DW006', 960001, 'F', 1,
    DATE '2034-02-01', 'A', 'R', '77777777-7777-7777-7777-777777777777'::uuid,
    repeat('a', 64)::char(64), DATE '2034-02-01', TRUE
);
INSERT INTO dw.dim_programa (
    member_type, id_programa, programa, id_facultad, facultad,
    id_nivel, nivel, sede, tipo_academico, activo, source_run_id
) VALUES (
    'STANDARD', 'SIS', 'Ingeniería de Sistemas', 10, 'Facultad de Ingeniería',
    1, 'Licenciatura', 'P', 'CAR', 'S', '77777777-7777-7777-7777-777777777777'::uuid
);
INSERT INTO dw.dim_materia (
    member_type, id_materia, sigla, materia, id_programa, id_plan,
    ciclo, nivel_academico, horas_teoricas, horas_practicas, creditos, source_run_id
) VALUES (
    'STANDARD', 96001, 'DW-101', 'Fundamentos de Data Warehouse', 'SIS', 1,
    1, 1, 64, 32, 8, '77777777-7777-7777-7777-777777777777'::uuid
);
INSERT INTO dw.dim_periodo_academico (
    member_type, gestion, periodo, effective_at, source_run_id
) VALUES (
    'STANDARD', 2034, 99, '2034-11-30 18:00:00-04'::timestamptz,
    '77777777-7777-7777-7777-777777777777'::uuid
);
INSERT INTO dw.dim_admision (member_type, id_acceso, source_run_id)
VALUES (
    'STANDARD', 'EX', '77777777-7777-7777-7777-777777777777'::uuid
);
UPDATE dw.dim_programa
SET programa = 'Ingeniería de Sistemas DW-006'
WHERE id_programa = 'SIS';

DO $$
BEGIN
    BEGIN
        INSERT INTO dw.dim_estudiante (
            member_type, id_ra, attribute_hash_scd2, valid_from, is_current
        ) VALUES (
            'STANDARD', 'RA-DW006', repeat('b', 64)::char(64), DATE '2034-02-01', TRUE
        );
        RAISE EXCEPTION 'Duplicado de id_ra no fue rechazado';
    EXCEPTION WHEN exclusion_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO dw.dim_programa (member_type, id_programa)
        VALUES ('STANDARD', 'SIS');
        RAISE EXCEPTION 'Duplicado de id_programa no fue rechazado';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO dw.dim_materia (member_type, id_materia)
        VALUES ('STANDARD', 96001);
        RAISE EXCEPTION 'Duplicado de id_materia no fue rechazado';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO dw.dim_periodo_academico (member_type, gestion, periodo)
        VALUES ('STANDARD', 2034, 99);
        RAISE EXCEPTION 'Duplicado de periodo académico no fue rechazado';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO dw.dim_admision (member_type, id_acceso)
        VALUES ('STANDARD', 'EX');
        RAISE EXCEPTION 'Duplicado de id_acceso no fue rechazado';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO dw.dim_programa (member_type)
        VALUES ('STANDARD');
        RAISE EXCEPTION 'Miembro estándar sin clave natural no fue rechazado';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO dw.dim_admision (admision_sk, member_type, technical_label)
        VALUES (-1, 'STANDARD', NULL);
        RAISE EXCEPTION 'Clave técnica usada por miembro estándar no fue rechazada';
    EXCEPTION WHEN check_violation OR unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO dw.dim_materia (member_type, id_materia, source_run_id)
        VALUES ('STANDARD', 96002, '88888888-8888-8888-8888-888888888888'::uuid);
        RAISE EXCEPTION 'run_id inexistente no fue rechazado';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;

    BEGIN
        UPDATE dw.dim_estudiante
        SET technical_label = 'Alterado'
        WHERE estudiante_sk = -1;
        RAISE EXCEPTION 'La modificación de UNKNOWN no fue rechazada';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN
        NULL;
    END;

    BEGIN
        DELETE FROM dw.dim_admision
        WHERE admision_sk = 0;
        RAISE EXCEPTION 'La eliminación de NOT_APPLICABLE no fue rechazada';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN
        NULL;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE dw_reader;
SELECT COUNT(*) FROM dw.dim_estudiante;
DO $$
BEGIN
    BEGIN
        INSERT INTO dw.dim_admision (member_type, id_acceso)
        VALUES ('STANDARD', 'RD');
        RAISE EXCEPTION 'dw_reader pudo insertar en una dimensión';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE dw_ml_writer;
SELECT COUNT(*) FROM dw.dim_programa;
DO $$
BEGIN
    BEGIN
        UPDATE dw.dim_programa
        SET programa = 'No permitido'
        WHERE id_programa = 'SIS';
        RAISE EXCEPTION 'dw_ml_writer pudo actualizar una dimensión';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE dw_transformer;
DO $$
BEGIN
    BEGIN
        PERFORM COUNT(*) FROM dw.dim_materia;
        RAISE EXCEPTION 'dw_transformer pudo leer dimensiones';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF NOT has_sequence_privilege(
        'dw_publisher', pg_get_serial_sequence('dw.dim_estudiante', 'estudiante_sk'), 'USAGE'
    ) OR NOT has_sequence_privilege(
        'dw_publisher', pg_get_serial_sequence('dw.dim_estudiante', 'estudiante_sk'), 'SELECT'
    ) THEN
        RAISE EXCEPTION 'dw_publisher no tiene acceso a la secuencia identity';
    END IF;

    IF (SELECT updated_at <= created_at
        FROM dw.dim_programa
        WHERE id_programa = 'SIS') THEN
        RAISE EXCEPTION 'La auditoría temporal de dimensiones es inválida';
    END IF;
END;
$$;

ROLLBACK;
