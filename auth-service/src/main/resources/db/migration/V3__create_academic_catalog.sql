-- Local snapshot tables populated by the academic ETL pipeline in a later change.
-- The academic system remains the source of truth.
CREATE TABLE academic_faculties (
    faculty_id       INTEGER NOT NULL,
    name             VARCHAR(100) NOT NULL,
    abbreviation     VARCHAR(50),
    source_status    CHAR(1),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at   TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_academic_faculties PRIMARY KEY (faculty_id)
);

CREATE TABLE academic_programs (
    career_id        CHAR(3) NOT NULL,
    faculty_id       INTEGER NOT NULL,
    name             VARCHAR(255) NOT NULL,
    source_status    VARCHAR(16),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at   TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_academic_programs PRIMARY KEY (career_id),
    CONSTRAINT uq_academic_programs_career_faculty UNIQUE (career_id, faculty_id),
    CONSTRAINT fk_academic_programs_on_faculty
        FOREIGN KEY (faculty_id) REFERENCES academic_faculties (faculty_id) ON DELETE RESTRICT
);

CREATE INDEX idx_academic_programs_faculty_id ON academic_programs (faculty_id);

ALTER TABLE user_academic_contexts
    ADD CONSTRAINT fk_user_academic_contexts_on_faculty
        FOREIGN KEY (faculty_id) REFERENCES academic_faculties (faculty_id) ON DELETE RESTRICT NOT VALID,
    ADD CONSTRAINT fk_user_academic_contexts_on_career_faculty
        FOREIGN KEY (career_id, faculty_id)
        REFERENCES academic_programs (career_id, faculty_id) ON DELETE RESTRICT NOT VALID;
