CREATE TABLE processed_keycloak_events (
    event_id VARCHAR(36) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_processed_keycloak_events PRIMARY KEY (event_id)
);
