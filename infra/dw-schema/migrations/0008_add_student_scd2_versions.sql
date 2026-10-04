-- DW-MVP-001 prerequisite: add effective-dated student dimension versions.
-- Apply only after migrations 0001-0007 through the migration runner.

DO $$
BEGIN
    IF to_regclass('etl_control.schema_migration') IS NULL
       OR to_regclass('etl_control.etl_execution') IS NULL
       OR to_regclass('dw.dim_estudiante') IS NULL THEN
        RAISE EXCEPTION 'DW-003, DW-004 y DW-006 deben estar aplicadas antes de DW-MVP-001';
    END IF;
END;
$$;

SET ROLE dw_owner;

ALTER TABLE dw.dim_estudiante
    ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS attribute_hash_scd2 CHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS identity_key TEXT GENERATED ALWAYS AS (
        CASE
            WHEN id_ra IS NOT NULL THEN 'RA:' || id_ra
            WHEN id_alumno IS NOT NULL THEN 'ALUMNO:' || id_alumno::TEXT
            ELSE NULL
        END
    ) STORED;

-- Existing STANDARD members have no approved source effective date. created_at
-- provides a technical baseline only; DSA/TI must reconcile it before historical facts.
UPDATE dw.dim_estudiante
SET valid_from = created_at,
    is_current = TRUE
WHERE member_type = 'STANDARD'
  AND valid_from IS NULL;

ALTER TABLE dw.dim_estudiante
    ADD CONSTRAINT ck_dim_estudiante_scd2_window CHECK (
        (member_type = 'STANDARD'
            AND valid_from IS NOT NULL
            AND (valid_to IS NULL OR valid_to > valid_from)
            AND is_current = (valid_to IS NULL))
        OR (member_type IN ('UNKNOWN', 'NOT_APPLICABLE')
            AND valid_from IS NULL
            AND valid_to IS NULL
            AND NOT is_current
            AND attribute_hash_scd2 IS NULL)
    ),
    ADD CONSTRAINT ck_dim_estudiante_scd2_hash CHECK (
        attribute_hash_scd2 IS NULL OR attribute_hash_scd2 ~ '^[0-9a-f]{64}$'
    ),
    ADD CONSTRAINT ck_dim_estudiante_scd2_hash_required CHECK (
        member_type <> 'STANDARD' OR attribute_hash_scd2 IS NOT NULL
    ) NOT VALID;

DROP INDEX IF EXISTS dw.uq_dim_estudiante_id_ra_standard;
DROP INDEX IF EXISTS dw.uq_dim_estudiante_id_alumno_standard;

CREATE UNIQUE INDEX uq_dim_estudiante_id_ra_current
    ON dw.dim_estudiante (id_ra)
    WHERE member_type = 'STANDARD' AND is_current AND id_ra IS NOT NULL;
CREATE UNIQUE INDEX uq_dim_estudiante_id_alumno_current
    ON dw.dim_estudiante (id_alumno)
    WHERE member_type = 'STANDARD' AND is_current AND id_alumno IS NOT NULL;
CREATE INDEX idx_dim_estudiante_identity_validity
    ON dw.dim_estudiante (identity_key, valid_from, valid_to)
    WHERE member_type = 'STANDARD';

ALTER TABLE dw.dim_periodo_academico
    ADD CONSTRAINT uq_dim_periodo_sk_closure UNIQUE (periodo_academico_sk, closure_id);

CREATE OR REPLACE FUNCTION dw.prevent_dim_estudiante_scd2_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, dw
AS $$
DECLARE
    v_lock_key TEXT;
BEGIN
    IF NEW.member_type <> 'STANDARD' THEN
        RETURN NEW;
    END IF;

    -- Serialize overlapping writes across both canonical and alternate identifiers.
    FOR v_lock_key IN
        SELECT lock_key
        FROM unnest(ARRAY[
            CASE WHEN NEW.id_ra IS NOT NULL THEN 'RA:' || NEW.id_ra END,
            CASE WHEN NEW.id_alumno IS NOT NULL THEN 'ALUMNO:' || NEW.id_alumno::TEXT END
        ]) AS keys(lock_key)
        WHERE lock_key IS NOT NULL
        ORDER BY lock_key
    LOOP
        PERFORM pg_advisory_xact_lock(
            hashtextextended('dw.dim_estudiante.scd2:' || v_lock_key, 0)
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM dw.dim_estudiante AS existing
        WHERE existing.member_type = 'STANDARD'
          AND existing.estudiante_sk <> coalesce(NEW.estudiante_sk, 0)
          AND (
              (NEW.id_ra IS NOT NULL AND existing.id_ra = NEW.id_ra)
              OR (NEW.id_alumno IS NOT NULL AND existing.id_alumno = NEW.id_alumno)
          )
          AND existing.valid_from < coalesce(NEW.valid_to, 'infinity'::timestamptz)
          AND NEW.valid_from < coalesce(existing.valid_to, 'infinity'::timestamptz)
    ) THEN
        RAISE EXCEPTION 'Las vigencias SCD2 de estudiante se solapan para una identidad existente'
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dw.protect_dim_estudiante_scd2_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, dw
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las versiones de estudiante son evidencia histórica y no se eliminan'
            USING ERRCODE = '55000';
    END IF;

    IF OLD.member_type = 'STANDARD' AND NOT OLD.is_current THEN
        RAISE EXCEPTION 'Una versión histórica de estudiante es inmutable'
            USING ERRCODE = '55000';
    END IF;

    IF OLD.member_type = 'STANDARD' AND ROW(
        NEW.member_type, NEW.id_ra, NEW.id_alumno, NEW.id_sexo, NEW.estado_civil,
        NEW.nac_pais, NEW.id_colegio, NEW.colegio, NEW.tipo_colegio,
        NEW.turno_colegio, NEW.area_colegio, NEW.cod_localidad, NEW.localidad,
        NEW.cod_pais, NEW.cod_departamento, NEW.cod_provincia,
        NEW.gestion_egreso_colegio, NEW.fec_inscripcion, NEW.fec_egreso,
        NEW.estado_academico, NEW.tipo_alumno, NEW.valid_from,
        NEW.attribute_hash_scd2
    ) IS DISTINCT FROM ROW(
        OLD.member_type, OLD.id_ra, OLD.id_alumno, OLD.id_sexo, OLD.estado_civil,
        OLD.nac_pais, OLD.id_colegio, OLD.colegio, OLD.tipo_colegio,
        OLD.turno_colegio, OLD.area_colegio, OLD.cod_localidad, OLD.localidad,
        OLD.cod_pais, OLD.cod_departamento, OLD.cod_provincia,
        OLD.gestion_egreso_colegio, OLD.fec_inscripcion, OLD.fec_egreso,
        OLD.estado_academico, OLD.tipo_alumno, OLD.valid_from,
        OLD.attribute_hash_scd2
    ) THEN
        RAISE EXCEPTION 'Los atributos de estudiante cambiantes requieren cerrar la versión y crear otra'
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dim_estudiante_scd2_no_overlap ON dw.dim_estudiante;
CREATE TRIGGER trg_dim_estudiante_scd2_no_overlap
BEFORE INSERT OR UPDATE OF id_ra, id_alumno, valid_from, valid_to, member_type
ON dw.dim_estudiante
FOR EACH ROW EXECUTE FUNCTION dw.prevent_dim_estudiante_scd2_overlap();
DROP TRIGGER IF EXISTS trg_dim_estudiante_scd2_protect_history ON dw.dim_estudiante;
CREATE TRIGGER trg_dim_estudiante_scd2_protect_history
BEFORE UPDATE OR DELETE ON dw.dim_estudiante
FOR EACH ROW EXECUTE FUNCTION dw.protect_dim_estudiante_scd2_history();

ALTER TABLE dw.dim_estudiante OWNER TO dw_owner;
ALTER FUNCTION dw.prevent_dim_estudiante_scd2_overlap() OWNER TO dw_owner;
ALTER FUNCTION dw.protect_dim_estudiante_scd2_history() OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION dw.prevent_dim_estudiante_scd2_overlap() FROM PUBLIC;
REVOKE ALL ON FUNCTION dw.protect_dim_estudiante_scd2_history() FROM PUBLIC;

COMMENT ON COLUMN dw.dim_estudiante.valid_from IS
    'Inicio efectivo inclusivo de la versión SCD2; proviene del cierre autorizado, no del tiempo de carga.';
COMMENT ON COLUMN dw.dim_estudiante.valid_to IS
    'Fin efectivo exclusivo de la versión SCD2; NULL identifica la versión vigente.';
COMMENT ON COLUMN dw.dim_estudiante.attribute_hash_scd2 IS
    'SHA-256 hexadecimal de atributos SCD2 canónicos; cálculo y provisión corresponden a Hop.';
COMMENT ON COLUMN dw.dim_estudiante.identity_key IS
    'Clave lógica de consulta: RA:<id_ra> cuando existe, de lo contrario ALUMNO:<id_alumno>.';
COMMENT ON TABLE dw.dim_estudiante IS
    'Dimensión de estudiante con vigencias semiabiertas SCD2; baseline histórico existente requiere reconciliación DSA/TI.';
