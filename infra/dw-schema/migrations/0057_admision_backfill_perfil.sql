-- 0057: admission mode codes up to 4 characters, and a one-off owner backfill of
-- the applicant profile for already published admissions.
--
-- * resolve_hop_dimension_key('admision', ...) cast the code to VARCHAR(2), so
--   mode 111 ("Examen P.S.A. sin curso de nivelación") would collide with 11.
-- * Re-running old closures to bring the 0056 profile would replay the SCD2
--   student history out of chronological order. Only admission changes, so
--   etl_control.backfill_hop_admission_profile(rows) updates the published
--   applications in place, matched by their source key (id_alumno_origen =
--   postulantes.id_alumno, unique). Rows come from Jachasun with the same
--   expressions as pl_fact_admision_mvp.hpl. Owner-only; new closures get the
--   profile from Hop directly.

SET ROLE dw_owner;

DO $$
DECLARE
    v_definition TEXT;
BEGIN
    v_definition := pg_get_functiondef('etl_control.resolve_hop_dimension_key(character varying,text)'::REGPROCEDURE);
    IF position('id_acceso = p_natural_key::VARCHAR(4)' IN v_definition) = 0 THEN
        IF position('id_acceso = p_natural_key::VARCHAR(2)' IN v_definition) = 0 THEN
            RAISE EXCEPTION '0057 did not find the admission key cast';
        END IF;
        EXECUTE replace(v_definition, 'id_acceso = p_natural_key::VARCHAR(2)', 'id_acceso = p_natural_key::VARCHAR(4)');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.backfill_hop_admission_profile(p_rows JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, dw
AS $$
DECLARE
    v_updated BIGINT;
    v_code TEXT;
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
        RAISE EXCEPTION 'Se esperaba un arreglo de postulaciones' USING ERRCODE = '22023';
    END IF;

    -- Mode members that the dimension does not have yet.
    FOR v_code IN
        SELECT DISTINCT nullif(btrim(e->>'modalidad'), '')
        FROM jsonb_array_elements(p_rows) e
        WHERE nullif(btrim(e->>'modalidad'), '') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dw.dim_admision a
                          WHERE a.member_type = 'STANDARD' AND a.id_acceso = btrim(e->>'modalidad'))
    LOOP
        INSERT INTO dw.dim_admision (admision_sk, member_type, id_acceso, created_at, updated_at)
        VALUES (etl_control.resolve_hop_dimension_key('admision', v_code), 'STANDARD', v_code::varchar(4),
                clock_timestamp(), clock_timestamp());
    END LOOP;

    WITH src AS (
        SELECT (e->>'id_alumno_origen')::integer AS id_alumno_origen,
               nullif(btrim(e->>'modalidad'), '') AS modalidad,
               nullif(upper(btrim(e->>'postulante_sexo')), '')::varchar(1) AS sexo,
               nullif(upper(btrim(e->>'postulante_tipo_colegio')), '')::varchar(1) AS tipo_colegio,
               nullif(e->>'colegio_pais', '')::integer AS colegio_pais,
               nullif(e->>'colegio_departamento', '')::integer AS colegio_departamento,
               nullif(e->>'colegio_provincia', '')::integer AS colegio_provincia,
               nullif(e->>'nacimiento_pais', '')::integer AS nacimiento_pais,
               nullif(e->>'nacimiento_departamento', '')::integer AS nacimiento_departamento,
               nullif(e->>'nacimiento_provincia', '')::integer AS nacimiento_provincia
        FROM jsonb_array_elements(p_rows) e
    ), resolved AS (
        SELECT s.*, coalesce(a.admision_sk, u.admision_sk) AS admision_sk
        FROM src s
        LEFT JOIN dw.dim_admision a ON a.member_type = 'STANDARD' AND a.id_acceso = s.modalidad
        CROSS JOIN (SELECT admision_sk FROM dw.dim_admision WHERE member_type = 'UNKNOWN') u
    )
    UPDATE dw.fact_admision f
    SET admision_sk = r.admision_sk,
        postulante_sexo = r.sexo,
        postulante_tipo_colegio = r.tipo_colegio,
        colegio_pais = r.colegio_pais,
        colegio_departamento = r.colegio_departamento,
        colegio_provincia = r.colegio_provincia,
        nacimiento_pais = r.nacimiento_pais,
        nacimiento_departamento = r.nacimiento_departamento,
        nacimiento_provincia = r.nacimiento_provincia
    FROM resolved r
    WHERE f.id_alumno_origen = r.id_alumno_origen
      AND (f.admision_sk, f.postulante_sexo, f.postulante_tipo_colegio, f.colegio_pais, f.colegio_departamento,
           f.colegio_provincia, f.nacimiento_pais, f.nacimiento_departamento, f.nacimiento_provincia)
          IS DISTINCT FROM
          (r.admision_sk, r.sexo, r.tipo_colegio, r.colegio_pais, r.colegio_departamento,
           r.colegio_provincia, r.nacimiento_pais, r.nacimiento_departamento, r.nacimiento_provincia);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION etl_control.backfill_hop_admission_profile(JSONB) FROM PUBLIC;
COMMENT ON FUNCTION etl_control.backfill_hop_admission_profile(JSONB) IS
    '0057: owner-only backfill of admission mode and applicant profile for published applications, matched by id_alumno_origen.';

RESET ROLE;
