-- Aggregate-only assertions for initial and replay runs of the catalog workflow.
DO $$
DECLARE
    v_faculties BIGINT;
    v_programs BIGINT;
    v_orphan_programs BIGINT;
    v_key_mismatches BIGINT;
    v_missing_timestamps BIGINT;
    v_missing_fk BIGINT;
BEGIN
    SELECT count(*) INTO v_faculties FROM public.academic_faculties;
    SELECT count(*) INTO v_programs FROM public.academic_programs;

    IF v_faculties <> 2 THEN
        RAISE EXCEPTION 'Expected 2 synchronized faculties; found %', v_faculties;
    END IF;
    IF v_programs <> 2 THEN
        RAISE EXCEPTION 'Expected 2 synchronized active programs; found %', v_programs;
    END IF;

    SELECT count(*) INTO v_orphan_programs
    FROM public.academic_programs p
    LEFT JOIN public.academic_faculties f ON f.faculty_id = p.faculty_id
    WHERE f.faculty_id IS NULL;
    IF v_orphan_programs <> 0 THEN
        RAISE EXCEPTION 'Found % programs without a local faculty', v_orphan_programs;
    END IF;

    SELECT count(*) INTO v_missing_fk
    FROM pg_constraint c
    WHERE c.conrelid = 'public.academic_programs'::regclass
      AND c.confrelid = 'public.academic_faculties'::regclass
      AND c.contype = 'f'
      AND c.convalidated;
    IF v_missing_fk = 0 THEN
        RAISE EXCEPTION 'The academic_programs to academic_faculties foreign key is missing or unvalidated';
    END IF;

    SELECT count(*) INTO v_key_mismatches
    FROM (
        (VALUES ('P01'::CHAR(3), 1), ('P02'::CHAR(3), 2)
         EXCEPT
         SELECT career_id, faculty_id FROM public.academic_programs)
        UNION ALL
        (SELECT career_id, faculty_id FROM public.academic_programs
         EXCEPT
         VALUES ('P01'::CHAR(3), 1), ('P02'::CHAR(3), 2))
    ) mismatches;
    IF v_key_mismatches <> 0 THEN
        RAISE EXCEPTION 'Program/faculty mapping differs from the synthetic source fixture';
    END IF;

    SELECT count(*) INTO v_missing_timestamps
    FROM (
        SELECT last_synced_at FROM public.academic_faculties
        UNION ALL
        SELECT last_synced_at FROM public.academic_programs
    ) synced_rows
    WHERE last_synced_at IS NULL;
    IF v_missing_timestamps <> 0 THEN
        RAISE EXCEPTION 'Found % synchronized rows without last_synced_at', v_missing_timestamps;
    END IF;

    IF has_table_privilege('hop_academic_catalog', 'public.academic_faculties', 'DELETE')
       OR has_table_privilege('hop_academic_catalog', 'public.academic_programs', 'DELETE') THEN
        RAISE EXCEPTION 'The Hop fixture principal unexpectedly has DELETE privilege';
    END IF;

    RAISE NOTICE 'Academic catalog sync assertions passed: faculties=%, programs=%, orphan_programs=0',
        v_faculties, v_programs;
END;
$$;
