-- DW-011 forward-only guard: existing RAW rows remain intact. NOT VALID
-- constraints protect all new writes while legacy data is reviewed separately.
DO $$
BEGIN
    IF to_regclass('staging.uq_raw_uatf_datos_run_id_ra') IS NULL THEN
        RAISE EXCEPTION 'DW-011 migration 0006 must be applied first';
    END IF;
END;
$$;

SET ROLE dw_owner;

ALTER TABLE staging.raw_uatf_datos
    ADD CONSTRAINT ck_raw_uatf_datos_required_fields
    CHECK (id_ra IS NOT NULL AND btrim(id_ra) <> ''
           AND estado_civil IS NOT NULL AND _modificado IS NOT NULL) NOT VALID;

RESET ROLE;

REVOKE UPDATE, DELETE ON TABLE staging.raw_uatf_datos FROM dw_staging_writer;

COMMENT ON CONSTRAINT ck_raw_uatf_datos_required_fields ON staging.raw_uatf_datos IS
    'DW-011: required source-contract fields for new RAW rows; legacy rows require separate validation.';
