-- Regression: an id_ra can be shared by different academic students.
BEGIN;

DO $$
BEGIN
    IF to_regclass('dw.uq_dim_estudiante_id_ra_current') IS NOT NULL THEN
        RAISE EXCEPTION 'id_ra must not be unique across current academic students';
    END IF;
    IF to_regclass('dw.uq_dim_estudiante_id_alumno_current') IS NULL THEN
        RAISE EXCEPTION 'current id_alumno uniqueness is required';
    END IF;
END;
$$;

INSERT INTO dw.dim_estudiante (
    estudiante_sk, member_type, id_ra, id_alumno, fec_inscripcion,
    estado_academico, tipo_alumno, valid_from, valid_to, is_current,
    attribute_hash_scd2
)
VALUES
    (910000001, 'STANDARD', 'SHAREDRA01', 910000001, DATE '2000-01-01',
     'A', 'R', TIMESTAMPTZ '2005-12-16 00:00:00+00', NULL, TRUE, repeat('a', 64)),
    (910000002, 'STANDARD', 'SHAREDRA01', 910000002, DATE '2000-01-01',
     'A', 'R', TIMESTAMPTZ '2005-12-16 00:00:00+00', NULL, TRUE, repeat('b', 64));

DO $$
BEGIN
    IF (SELECT count(*) FROM dw.dim_estudiante
        WHERE id_ra = 'SHAREDRA01' AND is_current) <> 2 THEN
        RAISE EXCEPTION 'two distinct id_alumno rows sharing id_ra should be accepted';
    END IF;
    IF (SELECT count(*) FROM dw.dim_estudiante
        WHERE estudiante_sk IN (910000001, 910000002)
          AND identity_key = 'ALUMNO:' || id_alumno::TEXT) <> 2 THEN
        RAISE EXCEPTION 'identity_key must prefer id_alumno';
    END IF;

    BEGIN
        INSERT INTO dw.dim_estudiante (
            estudiante_sk, member_type, id_ra, id_alumno, fec_inscripcion,
            estado_academico, tipo_alumno, valid_from, valid_to, is_current,
            attribute_hash_scd2
        ) VALUES (
            910000003, 'STANDARD', 'OTHER_RA', 910000001, DATE '2000-01-01',
            'A', 'R', TIMESTAMPTZ '2005-12-16 00:00:00+00', NULL, TRUE, repeat('c', 64)
        );
        RAISE EXCEPTION 'overlapping versions for the same id_alumno should fail';
    EXCEPTION WHEN exclusion_violation THEN
        NULL;
    END;
END;
$$;

ROLLBACK;
