-- DW-009: first typed RAW landing table for the Load Manager vertical slice.
DO $$
BEGIN
    IF to_regclass('etl_control.schema_migration') IS NULL
       OR to_regclass('etl_control.etl_source_manifest') IS NULL THEN
        RAISE EXCEPTION 'DW-003 and DW-004 must be applied before DW-009';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE TABLE IF NOT EXISTS staging.raw_uatf_datos (
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    row_ordinal BIGINT NOT NULL CHECK (row_ordinal > 0),
    id_ra VARCHAR(10),
    id_sexo VARCHAR(1),
    estado_civil SMALLINT,
    nac_pais INTEGER,
    id_colegio INTEGER,
    id_loc INTEGER,
    egr_gestion SMALLINT,
    _modificado TIMESTAMP WITHOUT TIME ZONE,
    row_sha256 CHAR(64) NOT NULL CHECK (row_sha256 ~ '^[0-9a-f]{64}$'),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (run_id, row_ordinal)
);

CREATE INDEX IF NOT EXISTS idx_raw_uatf_datos_run_id_ra
    ON staging.raw_uatf_datos (run_id, id_ra);

RESET ROLE;

REVOKE ALL ON TABLE staging.raw_uatf_datos FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE staging.raw_uatf_datos TO dw_staging_writer;
GRANT SELECT ON TABLE staging.raw_uatf_datos TO dw_transformer;

COMMENT ON TABLE staging.raw_uatf_datos IS
    'RAW snapshot de public.uatf_datos por run_id; no aplicar joins ni transformaciones en esta capa.';
