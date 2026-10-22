-- Regression for the historical snapshot volume that exhausted advisory-lock
-- shared memory after ~12.8k student rows. All writes are rolled back.
BEGIN;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (2098, 92, 'dsa:test', 'Prueba de volumen SCD2')
ON CONFLICT (gestion, periodo) DO NOTHING;

SELECT etl_control.transition_academic_period_closure(
    2098::smallint, 92::smallint, 'CERRADO'::varchar(16), 'dsa:test'::varchar(255),
    'Cierre de prueba para volumen SCD2', clock_timestamp() - interval '1 minute'
);

SELECT etl_control.create_hop_etl_execution(
    'a2200000-0000-0000-0000-000000000001'::uuid,
    'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure
     WHERE gestion = 2098 AND periodo = 92),
    NULL, NULL, NULL, NULL, 'Prueba de volumen SCD2 con 12821 estudiantes'
);
SELECT etl_control.start_hop_etl_execution(
    'a2200000-0000-0000-0000-000000000001'::uuid, 'Inicio prueba SCD2 de volumen'
);

SET LOCAL ROLE dw_hop_runtime;

DO $$
DECLARE
    v_rows INTEGER := 12821;
    v_i INTEGER;
    v_lock_count BIGINT;
    v_staged_count BIGINT := 0;
BEGIN
    FOR v_i IN 1..v_rows LOOP
        v_staged_count := v_staged_count + etl_control.prepare_hop_student_scd2(
            'a2200000-0000-0000-0000-000000000001'::uuid,
            jsonb_build_object(
                'id_alumno', 900000000 + v_i,
                'fec_inscripcion', DATE '2000-01-01',
                'estado_academico', 'A',
                'tipo_alumno', 'R'
            )
        );
    END LOOP;

    IF v_staged_count <> v_rows THEN
        RAISE EXCEPTION 'Expected % prepared student rows, function returned %', v_rows, v_staged_count;
    END IF;

    SELECT count(*) INTO v_lock_count
    FROM pg_locks
    WHERE pid = pg_backend_pid() AND locktype = 'advisory';
    IF v_lock_count > 2 THEN
        RAISE EXCEPTION 'Expected bounded advisory locks (<= 2), found %', v_lock_count;
    END IF;
END;
$$;

RESET ROLE;

-- Exercise the insert trigger at the same cardinality within this transaction.
INSERT INTO dw.dim_estudiante (
    estudiante_sk, member_type, id_ra, id_alumno, fec_inscripcion,
    estado_academico, tipo_alumno, valid_from, valid_to, is_current,
    attribute_hash_scd2
)
SELECT 910000000 + g, 'STANDARD', NULL, 910000000 + g, DATE '2000-01-01',
       'A', 'R', TIMESTAMPTZ '2005-12-16 00:00:00+00', NULL, TRUE,
       repeat('d', 64)
FROM generate_series(1, 12821) AS g;

DO $$
DECLARE
    v_lock_count BIGINT;
BEGIN
    SELECT count(*) INTO v_lock_count
    FROM pg_locks
    WHERE pid = pg_backend_pid() AND locktype = 'advisory';
    IF v_lock_count > 2 THEN
        RAISE EXCEPTION 'Student trigger retained unbounded advisory locks: %', v_lock_count;
    END IF;
END;
$$;

ROLLBACK;
