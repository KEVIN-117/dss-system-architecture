-- Test-only historical calendar derived from the reviewed
-- jachasun_academico_dct_asignaciones.csv (distinct gestion/periodo pairs).
-- The historical-closed status is an explicit assumption supplied for this
-- test. effective_at is estimated as 15 December of gestion, not an official
-- closure date. Never apply this seed to production or to the OLTP database.
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
END;
$$;

CREATE TEMP TABLE _dw_test_closure_candidates (
    gestion SMALLINT NOT NULL,
    periodo SMALLINT NOT NULL CHECK (periodo > 0),
    PRIMARY KEY (gestion, periodo)
) ON COMMIT DROP;

INSERT INTO _dw_test_closure_candidates (gestion, periodo)
VALUES
    (2000,1),
    (2001,1),(2001,2),
    (2002,1),(2002,2),(2002,3),
    (2003,1),(2003,2),(2003,3),
    (2004,1),(2004,2),(2004,3),(2004,4),
    (2005,1),(2005,2),(2005,3),(2005,4),
    (2006,1),(2006,2),(2006,3),
    (2007,1),(2007,2),(2007,3),(2007,4),(2007,5),
    (2008,1),(2008,2),(2008,3),
    (2009,1),(2009,2),(2009,3),
    (2010,1),(2010,2),(2010,3),
    (2011,1),(2011,2),(2011,3),
    (2012,1),(2012,2),(2012,3),(2012,4),(2012,5),(2012,50),(2012,51),
    (2013,1),(2013,2),(2013,3),
    (2014,1),(2014,2),(2014,3),(2014,4),(2014,5),
    (2015,1),(2015,2),(2015,3),(2015,4),(2015,5),(2015,10),
    (2016,1),(2016,2),(2016,3),(2016,4),(2016,5),(2016,6),(2016,7),
    (2017,1),(2017,2),(2017,3),(2017,4),(2017,5),(2017,6),
    (2018,1),(2018,2),(2018,3),(2018,4),(2018,5),
    (2019,1),(2019,2),(2019,3),(2019,4),(2019,5),
    (2020,1),(2020,2),(2020,3),(2020,4),(2020,5),
    (2021,1),(2021,2),(2021,3),(2021,4),(2021,5),
    (2022,1),(2022,4);

DO $$
BEGIN
    IF (SELECT count(*) FROM _dw_test_closure_candidates) <> 93 THEN
        RAISE EXCEPTION 'Expected 93 distinct valid historical cuts in the reviewed CSV';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _dw_test_closure_candidates p
        JOIN etl_control.academic_period_closure c USING (gestion, periodo)
        WHERE c.status NOT IN ('CERRADO', 'PROCESADO')
    ) THEN
        RAISE EXCEPTION 'A candidate test cut exists but is not closed; no existing closure was changed';
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
    SELECT p.gestion,
           p.periodo,
           'PENDIENTE',
           'test:dct-asignaciones-historical-seed',
           'DW_TEST: histórico asumido cerrado según indicación del usuario; fuente CSV dct_asignaciones; effective_at estimado al 15 de diciembre'
    FROM _dw_test_closure_candidates p
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
            v_cut.gestion, 12, 15, 23, 59, 59, 'America/La_Paz'
        );
        PERFORM etl_control.transition_academic_period_closure(
            v_cut.gestion,
            v_cut.periodo,
            'CERRADO',
            'test:dct-asignaciones-historical-seed',
            'DW_TEST: cierre histórico de prueba asumido; effective_at estimado al 15 de diciembre, no oficial',
            v_effective_at,
            NULL
        );
    END LOOP;
END;
$$;

DO $$
DECLARE
    v_closed_count INTEGER;
BEGIN
    SELECT count(*) INTO v_closed_count
    FROM _dw_test_closure_candidates p
    JOIN etl_control.academic_period_closure c USING (gestion, periodo)
    WHERE c.status IN ('CERRADO', 'PROCESADO')
      AND c.effective_at IS NOT NULL;

    IF v_closed_count <> 93 THEN
        RAISE EXCEPTION 'Expected 93 available historical cuts, found %', v_closed_count;
    END IF;
END;
$$;

SELECT count(*) AS new_historical_test_closures
FROM _dw_test_closures_created;

SELECT count(*) AS available_historical_cuts
FROM _dw_test_closure_candidates p
JOIN etl_control.academic_period_closure c USING (gestion, periodo)
WHERE c.status IN ('CERRADO', 'PROCESADO');

COMMIT;
