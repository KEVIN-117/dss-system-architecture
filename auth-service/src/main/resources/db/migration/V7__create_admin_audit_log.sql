-- IAM-005: persistent audit log of administrative operations (users, roles, permissions, clients).
-- before_state/after_state hold sanitized JSON snapshots; secrets are redacted before they reach this table.
CREATE TABLE admin_audit_log (
    id                UUID          NOT NULL,
    occurred_at       TIMESTAMPTZ   NOT NULL,
    actor_keycloak_id VARCHAR(64),
    actor_username    VARCHAR(255),
    action            VARCHAR(100)  NOT NULL,
    target_type       VARCHAR(30)   NOT NULL,
    target_id         VARCHAR(255),
    before_state      JSONB,
    after_state       JSONB,
    ip_address        VARCHAR(64),
    outcome           VARCHAR(20)   NOT NULL,
    failure_reason    VARCHAR(1000),
    completed_at      TIMESTAMPTZ,
    CONSTRAINT pk_admin_audit_log PRIMARY KEY (id),
    CONSTRAINT ck_admin_audit_log_outcome CHECK (outcome IN ('PENDING', 'SUCCESS', 'FAILURE')),
    CONSTRAINT ck_admin_audit_log_target_type CHECK (target_type IN ('USER', 'ROLE', 'PERMISSION', 'CLIENT'))
);

CREATE INDEX idx_admin_audit_log_occurred_at ON admin_audit_log (occurred_at DESC, id DESC);
CREATE INDEX idx_admin_audit_log_actor ON admin_audit_log (actor_keycloak_id, occurred_at DESC);
CREATE INDEX idx_admin_audit_log_actor_username ON admin_audit_log (actor_username, occurred_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log (action, occurred_at DESC);
CREATE INDEX idx_admin_audit_log_target ON admin_audit_log (target_type, target_id, occurred_at DESC);

-- revinfo/revchanges were created by V1 for Hibernate Envers, which was never added: no entity is @Audited and
-- nothing writes to them. admin_audit_log replaces them as the audit store.
DROP TABLE IF EXISTS revchanges;
DROP TABLE IF EXISTS revinfo;
DROP SEQUENCE IF EXISTS revinfo_seq;
