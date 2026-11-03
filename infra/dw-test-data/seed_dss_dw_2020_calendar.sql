-- Calendario sintético mínimo para volver a cargar el corte 2020/2 en dss_dw.
-- Solo para desarrollo: fechas aproximadas, no son cierres oficiales DSA.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
    IF current_database() <> 'dss_dw' THEN
        RAISE EXCEPTION 'Calendario rechazado: se esperaba dss_dw, base actual: %', current_database();
    END IF;
    IF current_setting('dw_test.allow_synthetic_closures', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Se requiere SET dw_test.allow_synthetic_closures = on';
    END IF;
    IF EXISTS (
        SELECT 1 FROM etl_control.etl_execution
        WHERE status IN ('SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO')
    ) THEN
        RAISE EXCEPTION 'No se puede sembrar el calendario con ejecuciones ETL activas';
    END IF;
END;
$$;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, status, created_by_subject, closure_reason
)
VALUES
    (2020, 1, 'PENDIENTE', 'test:faker-calendar', 'DW_TEST: fecha sintética aproximada para validar ETL; no oficial'),
    (2020, 2, 'PENDIENTE', 'test:faker-calendar', 'DW_TEST: fecha sintética aproximada para validar ETL; no oficial'),
    (2021, 1, 'PENDIENTE', 'test:faker-calendar', 'DW_TEST: corte siguiente sintético para validar secuencia; no oficial')
ON CONFLICT (gestion, periodo) DO NOTHING;

SELECT etl_control.transition_academic_period_closure(
    2020::smallint, 1::smallint, 'CERRADO'::varchar, 'test:faker-calendar'::varchar,
    'DW_TEST: fecha sintética aproximada para validar ETL; no oficial',
    '2020-06-30 23:59:59 America/La_Paz'::timestamptz, NULL::uuid
);
SELECT etl_control.transition_academic_period_closure(
    2020::smallint, 2::smallint, 'CERRADO'::varchar, 'test:faker-calendar'::varchar,
    'DW_TEST: fecha sintética aproximada para validar ETL; no oficial',
    '2020-12-31 23:59:59 America/La_Paz'::timestamptz, NULL::uuid
);
SELECT etl_control.transition_academic_period_closure(
    2021::smallint, 1::smallint, 'CERRADO'::varchar, 'test:faker-calendar'::varchar,
    'DW_TEST: corte siguiente sintético para validar secuencia; no oficial',
    '2021-06-30 23:59:59 America/La_Paz'::timestamptz, NULL::uuid
);

COMMIT;

SELECT gestion, periodo, status, effective_at
FROM etl_control.academic_period_closure
WHERE (gestion, periodo) IN ((2020, 1), (2020, 2), (2021, 1))
ORDER BY effective_at;
