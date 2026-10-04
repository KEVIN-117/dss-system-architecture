-- DW-013: resolve/reuse natural-key surrogate keys without granting Hop
-- direct SELECT access to dimensional tables.
BEGIN;

DO $$
BEGIN
    IF to_regclass('dw.dim_programa') IS NULL
       OR to_regclass('dw.dim_materia') IS NULL
       OR to_regclass('dw.dim_periodo_academico') IS NULL
       OR to_regclass('dw.dim_admision') IS NULL THEN
        RAISE EXCEPTION 'DW-006 dimensions must exist before installing the Hop key resolver';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.resolve_hop_dimension_key(
    p_dimension VARCHAR(32),
    p_natural_key TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, dw
AS $$
DECLARE
    v_key BIGINT;
    v_gestion SMALLINT;
    v_periodo SMALLINT;
BEGIN
    -- Hop asks PostgreSQL for transform metadata with NULL bind values. That
    -- describe-only query must not allocate a sequence value or stage a row.
    IF p_natural_key IS NULL OR btrim(p_natural_key) = '' THEN
        RETURN NULL;
    END IF;

    CASE p_dimension
        WHEN 'programa' THEN
            SELECT programa_sk INTO v_key
            FROM dw.dim_programa
            WHERE member_type = 'STANDARD' AND id_programa = p_natural_key::VARCHAR(3);
        WHEN 'materia' THEN
            SELECT materia_sk INTO v_key
            FROM dw.dim_materia
            WHERE member_type = 'STANDARD' AND id_materia = p_natural_key::INTEGER;
        WHEN 'periodo_academico' THEN
            v_gestion := split_part(p_natural_key, '-', 1)::SMALLINT;
            v_periodo := split_part(p_natural_key, '-', 2)::SMALLINT;
            SELECT periodo_academico_sk INTO v_key
            FROM dw.dim_periodo_academico
            WHERE member_type = 'STANDARD'
              AND gestion = v_gestion AND periodo = v_periodo;
        WHEN 'admision' THEN
            SELECT admision_sk INTO v_key
            FROM dw.dim_admision
            WHERE member_type = 'STANDARD' AND id_acceso = p_natural_key::VARCHAR(2);
        ELSE
            RAISE EXCEPTION 'Dimensión no autorizada para resolver surrogate key'
                USING ERRCODE = '42501';
    END CASE;

    IF v_key IS NOT NULL THEN
        RETURN v_key;
    END IF;
    RETURN etl_control.reserve_hop_dimension_key(p_dimension);
END;
$$;

ALTER FUNCTION etl_control.resolve_hop_dimension_key(VARCHAR, TEXT) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.resolve_hop_dimension_key(VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.resolve_hop_dimension_key(VARCHAR, TEXT) TO dw_hop_runtime;
GRANT SELECT ON TABLE etl_control.academic_period_closure TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.resolve_hop_dimension_key(VARCHAR, TEXT) IS
    'Resuelve o reserva claves dimensionales permitidas bajo SECURITY DEFINER; no otorga SELECT directo al runtime Hop.';

COMMIT;
