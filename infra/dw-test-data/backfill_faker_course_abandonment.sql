-- Development-only backfill for the Faker-seeded DW after migration 0033.
-- The migration fixes future ETL publication; this script updates only the
-- already-loaded synthetic rows so the simulation snapshot can use the fact flag.
BEGIN;

DO $$
BEGIN
    IF current_database() <> 'dss_dw'
       OR current_setting('dw_test.allow_faker_course_label_backfill', true) <> 'on' THEN
        RAISE EXCEPTION
            'Refusing Faker label backfill: connect to dss_dw and explicitly set dw_test.allow_faker_course_label_backfill=on';
    END IF;
    IF to_regclass('dw.fact_cursado') IS NULL
       OR to_regclass('etl_control.schema_migration') IS NULL
       OR NOT EXISTS (
            SELECT 1 FROM etl_control.schema_migration WHERE version = '0033'
       ) THEN
        RAISE EXCEPTION 'Faker label backfill requires DW migration 0033';
    END IF;
END;
$$;

UPDATE dw.fact_cursado
SET es_abandono = CASE
    WHEN upper(btrim(estado_origen)) IN ('X', 'I') THEN TRUE
    WHEN upper(btrim(estado_origen)) IN ('A', 'R', 'H', 'C', 'S', 'D') THEN FALSE
    ELSE NULL
END
WHERE es_abandono IS DISTINCT FROM CASE
    WHEN upper(btrim(estado_origen)) IN ('X', 'I') THEN TRUE
    WHEN upper(btrim(estado_origen)) IN ('A', 'R', 'H', 'C', 'S', 'D') THEN FALSE
    ELSE NULL
END;

DO $$
DECLARE
    v_unknown_count BIGINT;
    v_expected_abandoned BIGINT;
    v_actual_abandoned BIGINT;
BEGIN
    SELECT count(*) INTO v_unknown_count
    FROM dw.fact_cursado
    WHERE upper(btrim(estado_origen)) NOT IN ('X', 'I', 'A', 'R', 'H', 'C', 'S', 'D');
    SELECT count(*) INTO v_expected_abandoned
    FROM dw.fact_cursado WHERE upper(btrim(estado_origen)) IN ('X', 'I');
    SELECT count(*) INTO v_actual_abandoned
    FROM dw.fact_cursado WHERE es_abandono IS TRUE;
    IF v_expected_abandoned <> v_actual_abandoned THEN
        RAISE EXCEPTION 'Faker abandonment flag mismatch: expected %, actual %',
            v_expected_abandoned, v_actual_abandoned;
    END IF;
    RAISE NOTICE 'Faker course labels: abandoned %, unknown-state rows %',
        v_actual_abandoned, v_unknown_count;
END;
$$;

COMMIT;
