-- Test-only DSA calendar for the synthetic historical fixture.
-- It is deliberately separate from the OLTP seed and never reads dct_asignaciones.
-- Effective timestamps define an artificial test order, not official academic dates.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
    IF current_setting('dw_test.allow_synthetic_closures', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Set dw_test.allow_synthetic_closures=on explicitly for a disposable DW test database';
    END IF;
    IF current_database() IN ('jachasun', 'jachasun_test') THEN
        RAISE EXCEPTION 'Academic closures belong to the DW database, not the OLTP source';
    END IF;
    IF to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regprocedure('etl_control.transition_academic_period_closure(smallint,smallint,character varying,character varying,text,timestamp with time zone,uuid)') IS NULL THEN
        RAISE EXCEPTION 'Apply DW migrations before seeding test closures';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM generate_series(2000, 2025) AS y(gestion)
        CROSS JOIN (VALUES (1::smallint), (2::smallint)) AS p(periodo)
        JOIN etl_control.academic_period_closure c
          ON c.gestion = y.gestion AND c.periodo = p.periodo
        WHERE c.status NOT IN ('CERRADO', 'PROCESADO')
    ) THEN
        RAISE EXCEPTION 'A requested test cut already exists but is not closed; no existing closure was changed';
    END IF;
END;
$$;

CREATE TEMP TABLE _dw_test_closures_created (
    gestion SMALLINT NOT NULL,
    periodo SMALLINT NOT NULL,
    PRIMARY KEY (gestion, periodo)
) ON COMMIT DROP;

WITH inserted AS (
    INSERT INTO etl_control.academic_period_closure (
        gestion, periodo, status, created_by_subject, closure_reason
    )
    SELECT y.gestion::smallint,
           p.periodo,
           'PENDIENTE',
           'test:synthetic-fixture-v2',
           'DW_TEST_V2: cierre sintético para pruebas; no representa aprobación real de DSA'
    FROM generate_series(2000, 2025) AS y(gestion)
    CROSS JOIN (VALUES (1::smallint), (2::smallint)) AS p(periodo)
    ON CONFLICT (gestion, periodo) DO NOTHING
    RETURNING gestion, periodo
)
INSERT INTO _dw_test_closures_created (gestion, periodo)
SELECT gestion, periodo FROM inserted;

DO $$
DECLARE
    v_cut RECORD;
    v_effective_at TIMESTAMPTZ;
BEGIN
    FOR v_cut IN
        SELECT gestion, periodo
        FROM _dw_test_closures_created
        ORDER BY gestion, periodo
    LOOP
        v_effective_at := make_timestamptz(
            v_cut.gestion,
            CASE WHEN v_cut.periodo = 1 THEN 6 ELSE 12 END,
            CASE WHEN v_cut.periodo = 1 THEN 30 ELSE 31 END,
            23, 59, 0,
            'America/La_Paz'
        );
        PERFORM etl_control.transition_academic_period_closure(
            v_cut.gestion,
            v_cut.periodo,
            'CERRADO',
            'dsa:synthetic-fixture-v2',
            'DW_TEST_V2: cierre ficticio para demostrar ETL; fecha efectiva sintética',
            v_effective_at,
            NULL
        );
    END LOOP;
END;
$$;

SELECT count(*) AS new_synthetic_closures
FROM _dw_test_closures_created;

SELECT count(*) AS available_test_cuts
FROM etl_control.academic_period_closure
WHERE gestion BETWEEN 2000 AND 2025
  AND periodo IN (1, 2)
  AND status IN ('CERRADO', 'PROCESADO');

COMMIT;
