-- 0061: keep refresh_hop_retention_performance on a hash-join plan.
--
-- During the historical load (cut 2020-1), the publish ran for more than 2 h
-- at 100 % CPU inside refresh_hop_retention_performance(), called by
-- mature_hop_retention_labels(). The same computation for cut 2019-2 (13 844
-- students, 605 579 history attempts) takes 2-3 minutes on hash joins when run
-- outside the publish.
--
-- Inside the publish transaction the rows of the new cut were just written
-- and have no statistics. The table statistics were also stale (1 PROCESADO
-- closure estimated instead of 24, 577 retention rows per cut instead of
-- 14-20 thousand). With those estimates the planner can choose a nested loop
-- for the target_rows x history join (point-in-time inequality), which is
-- quadratic in the number of students and attempts of the cut.
--
-- The function reads whole cuts, so a hash plan is always right for it:
-- nested loops are disabled for this function only. The planner can still use
-- a nested loop if it has no other option. Other functions and sessions do not
-- change. The tables involved are analyzed again.

DO $$
BEGIN
    IF to_regprocedure('etl_control.refresh_hop_retention_performance(bigint[])') IS NULL THEN
        RAISE EXCEPTION '0061 requires etl_control.refresh_hop_retention_performance(bigint[]) (0046/0047)';
    END IF;
END;
$$;

SET ROLE dw_owner;

ALTER FUNCTION etl_control.refresh_hop_retention_performance(BIGINT[])
    SET enable_nestloop = off;

RESET ROLE;

ANALYZE etl_control.academic_period_closure;
ANALYZE dw.fact_retencion_desercion;
ANALYZE dw.fact_cursado;
ANALYZE dw.dim_estudiante;
ANALYZE dw.dim_periodo_academico;

COMMENT ON FUNCTION etl_control.refresh_hop_retention_performance(BIGINT[]) IS
    '0046/0047: point-in-time ppa_acumulado, materias_arrastradas, tipo_estudiante and gestion_ingreso for published retention rows of the given PROCESADO closures; returns changed rows. Owner-only. Recompute every closure if earlier history is loaded later. 0061: runs with enable_nestloop = off (hash plan for whole cuts).';

DO $$
DECLARE
    v_config TEXT[];
BEGIN
    SELECT p.proconfig INTO v_config
    FROM pg_proc p
    WHERE p.oid = 'etl_control.refresh_hop_retention_performance(bigint[])'::REGPROCEDURE;
    IF NOT ('enable_nestloop=off' = ANY (v_config)) OR NOT ('work_mem=256MB' = ANY (v_config)) THEN
        RAISE EXCEPTION '0061 function configuration is not as expected: %', v_config;
    END IF;
END;
$$;
