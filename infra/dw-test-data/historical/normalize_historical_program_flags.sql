\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    v_source_count BIGINT;
    v_catalog_count BIGINT;
    v_source_a BIGINT;
    v_source_b BIGINT;
    v_source_s BIGINT;
    v_source_n BIGINT;
BEGIN
    IF current_database() <> 'jachasun' THEN
        RAISE EXCEPTION 'Refusing to normalize program flags outside the disposable jachasun test database';
    END IF;

    SELECT count(*) INTO v_source_count FROM academico.alm_programas;
    SELECT count(*) INTO v_catalog_count FROM public.fac_programas;
    SELECT count(*) FILTER (WHERE activo='A'),
           count(*) FILTER (WHERE activo='B'),
           count(*) FILTER (WHERE activo='S'),
           count(*) FILTER (WHERE activo='N')
      INTO v_source_a, v_source_b, v_source_s, v_source_n
      FROM academico.alm_programas;

    IF v_source_count <> 85 OR v_catalog_count <> 85 THEN
        RAISE EXCEPTION 'Expected exactly the 85-row synthetic catalog in both program tables; found source %, auxiliary %',
            v_source_count, v_catalog_count;
    END IF;

    IF v_source_a = 73 AND v_source_b = 12 AND v_source_s = 0 AND v_source_n = 0 THEN
        UPDATE academico.alm_programas p
           SET activo = CASE f.activo WHEN 'A' THEN 'S' WHEN 'B' THEN 'N' END
          FROM public.fac_programas f
         WHERE p.id_programa = f.id_programa
           AND f.activo IN ('A','B');
    ELSIF v_source_a = 0 AND v_source_b = 0 AND v_source_s = 73 AND v_source_n = 12 THEN
        RAISE NOTICE 'Program flags are already normalized; no update required';
    ELSE
        RAISE EXCEPTION 'Unexpected program flag distribution (A %, B %, S %, N %); inspect the disposable fixture before changing it',
            v_source_a, v_source_b, v_source_s, v_source_n;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM academico.alm_programas p
          LEFT JOIN public.fac_programas f ON f.id_programa = p.id_programa
         WHERE f.id_programa IS NULL
            OR p.activo IS DISTINCT FROM CASE f.activo WHEN 'A' THEN 'S' WHEN 'B' THEN 'N' END
    ) THEN
        RAISE EXCEPTION 'Normalized operational program flags do not match the source fixture catalog';
    END IF;
END $$;

COMMIT;
