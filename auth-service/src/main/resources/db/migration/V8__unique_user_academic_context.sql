-- IAM-009: a user can hold several academic contexts (e.g. an acting dean of two faculties), but never the same one
-- twice. Until now the service allowed a single context, so duplicates are not expected; any that exist are identical
-- rows and the oldest one is kept.
DELETE FROM user_academic_contexts newer
USING user_academic_contexts older
WHERE newer.user_id = older.user_id
  AND newer.faculty_id IS NOT DISTINCT FROM older.faculty_id
  AND newer.career_id IS NOT DISTINCT FROM older.career_id
  AND (newer.created_at, newer.id) > (older.created_at, older.id);

ALTER TABLE user_academic_contexts
    ADD CONSTRAINT uq_user_academic_contexts_scope UNIQUE NULLS NOT DISTINCT (user_id, faculty_id, career_id);
