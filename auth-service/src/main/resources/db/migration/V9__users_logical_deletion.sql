-- IAM-010: users deleted in Keycloak are deleted logically. The row keeps its id (admin_audit_log refers to it) but is
-- anonymized, deactivated and excluded from the directory; deleted_at records when the deletion was synchronized.
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
