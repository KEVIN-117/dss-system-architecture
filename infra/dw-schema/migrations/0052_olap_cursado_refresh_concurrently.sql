-- 0052: refreshing the OLAP coursework base must not block OLAP readers.
--
-- 0051 refreshed dw.mv_fact_cursado_olap with a plain REFRESH inside the
-- publication transaction. That takes an ACCESS EXCLUSIVE lock held until the
-- transaction ends, so every OLAP query on "Rendimiento académico" waited and
-- hit the 60 s datasource timeout during a publication. CONCURRENTLY (using the
-- unique index on fact_cursado_id) only takes an EXCLUSIVE lock: readers keep
-- seeing the previous content until the publication commits.

DO $$
DECLARE
    v_definition TEXT;
    c_old CONSTANT TEXT := 'REFRESH MATERIALIZED VIEW dw.mv_fact_cursado_olap;';
    c_new CONSTANT TEXT := 'REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_fact_cursado_olap;';
BEGIN
    IF to_regclass('dw.uq_mv_fact_cursado_olap_id') IS NULL THEN
        RAISE EXCEPTION '0052 requires the 0051 unique index on mv_fact_cursado_olap';
    END IF;
    v_definition := pg_get_functiondef('etl_control.mature_hop_retention_labels(uuid)'::REGPROCEDURE);
    IF position(c_new IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_old, '')) <> length(c_old) THEN
            RAISE EXCEPTION '0052 expected exactly one REFRESH of mv_fact_cursado_olap';
        END IF;
        EXECUTE 'SET ROLE dw_owner';
        EXECUTE replace(v_definition, c_old, c_new);
        EXECUTE 'RESET ROLE';
    END IF;
END;
$$;
