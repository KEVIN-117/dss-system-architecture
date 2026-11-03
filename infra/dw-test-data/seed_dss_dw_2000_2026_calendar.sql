-- Calendario sintético completo para los periodos con seed Faker 2000–2026.
-- Códigos: 1/2 semestrales; 3 anual. Fechas aproximadas, no cierres oficiales DSA.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
    v_year SMALLINT;
    v_period SMALLINT;
    v_effective_at TIMESTAMPTZ;
    v_closure etl_control.academic_period_closure;
    v_reason TEXT := 'DW_TEST: calendario sintético Faker 2000-2026; periodos 1/2 semestrales, 3 anual; fecha aproximada, no oficial DSA';
BEGIN
    IF current_database() <> 'dss_dw' THEN
        RAISE EXCEPTION 'Calendario rechazado: se esperaba dss_dw, base actual: %', current_database();
    END IF;
    IF current_setting('dw_test.allow_synthetic_closures', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Se requiere habilitar dw_test.allow_synthetic_closures = on en esta sesión';
    END IF;
    IF EXISTS (
        SELECT 1 FROM etl_control.etl_execution
        WHERE status IN ('SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO')
    ) THEN
        RAISE EXCEPTION 'No se puede sembrar el calendario con ejecuciones ETL activas';
    END IF;

    FOR v_year IN 2000..2026 LOOP
        FOR v_period IN 1..3 LOOP
            v_effective_at := CASE WHEN v_period = 1
                THEN make_timestamptz(v_year, 6, 30, 23, 59, 59, 'America/La_Paz')
                ELSE make_timestamptz(v_year, 12, 31, 23, 59, 59, 'America/La_Paz')
            END;

            SELECT * INTO v_closure
            FROM etl_control.academic_period_closure
            WHERE gestion = v_year AND periodo = v_period
            FOR UPDATE;

            IF NOT FOUND THEN
                v_closure := etl_control.create_academic_period_closure(
                    v_year::smallint, v_period::smallint,
                    'test:faker-calendar'::varchar, v_reason
                );
            END IF;

            IF v_effective_at <= clock_timestamp() THEN
                IF v_closure.status = 'PENDIENTE' THEN
                    PERFORM etl_control.transition_academic_period_closure(
                        v_year::smallint, v_period::smallint, 'CERRADO'::varchar,
                        'test:faker-calendar'::varchar, v_reason, v_effective_at, NULL::uuid
                    );
                ELSIF v_closure.status = 'REABIERTO' THEN
                    RAISE EXCEPTION 'El cierre sintético %/% está REABIERTO; requiere resolución explícita',
                        v_year, v_period;
                ELSIF v_closure.effective_at IS DISTINCT FROM v_effective_at THEN
                    RAISE EXCEPTION 'La fecha del cierre existente %/% difiere del calendario sintético',
                        v_year, v_period;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

COMMIT;

SELECT gestion, periodo, status, effective_at, processed_run_id
FROM etl_control.academic_period_closure
WHERE gestion BETWEEN 2000 AND 2026
ORDER BY gestion, periodo;
