-- Bound and spread publisher retries during RabbitMQ outages.
ALTER TABLE ml_workspace.training_job_outbox
    ADD COLUMN next_attempt_at TIMESTAMPTZ;

CREATE INDEX training_job_outbox_due_idx
    ON ml_workspace.training_job_outbox(next_attempt_at, outbox_id)
    WHERE published_at IS NULL;
