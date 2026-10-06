DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM user_academic_contexts
        WHERE career_id IS NOT NULL
          AND (career_id < 0 OR career_id > 999)
    ) THEN
        RAISE EXCEPTION 'Cannot convert career_id values outside the CHAR(3) numeric range (000-999).';
    END IF;
END;
$$;

ALTER TABLE user_academic_contexts
    ALTER COLUMN career_id TYPE CHAR(3)
    USING CASE
        WHEN career_id IS NULL THEN NULL
        ELSE lpad(career_id::text, 3, '0')::CHAR(3)
    END;
