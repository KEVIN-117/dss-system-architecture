-- 1. Función para actualizar automáticamente la columna updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Tabla Temporal de Ejemplo (para compatibilidad de código base)
CREATE TABLE example_users (
    id    VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL,
    CONSTRAINT pk_example_users PRIMARY KEY (id),
    CONSTRAINT uc_example_users_email UNIQUE (email)
);

-- 3. Tabla de Usuarios (Sincronizada desde Keycloak)
CREATE TABLE users (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    keycloak_id UUID NOT NULL,
    username    VARCHAR(50) NOT NULL,
    email       VARCHAR(320) NOT NULL,
    first_name  VARCHAR(100),
    last_name   VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uc_users_keycloak_id UNIQUE (keycloak_id),
    CONSTRAINT uc_users_username UNIQUE (username),
    CONSTRAINT uc_users_email UNIQUE (email)
);

-- Asignar Trigger a la tabla de Usuarios
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Índice parcial para búsquedas ultrarrápidas de login (usuarios activos)
CREATE INDEX idx_users_active_email 
    ON users(email) 
    WHERE is_active = TRUE;

-- 4. Tabla de Roles
CREATE TABLE roles (
    id          INT NOT NULL,
    name        VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    CONSTRAINT pk_roles PRIMARY KEY (id),
    CONSTRAINT uc_roles_name UNIQUE (name)
);

-- 5. Relación M:N de Usuarios y Roles (USER_ROLE)
CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role_id INT NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_on_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_on_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);

-- 6. Contexto Académico (para segregación por RNF4.1)
CREATE TABLE user_academic_contexts (
    id         UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    faculty_id INT,
    career_id  INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_user_academic_contexts PRIMARY KEY (id),
    CONSTRAINT fk_user_academic_contexts_on_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_career_requires_faculty CHECK (career_id IS NULL OR faculty_id IS NOT NULL)
);

-- 7. Tablas de Auditoría (Hibernate Envers)
CREATE SEQUENCE IF NOT EXISTS revinfo_seq START WITH 1 INCREMENT BY 50;

CREATE TABLE revinfo (
    rev      BIGINT NOT NULL,
    revtstmp BIGINT,
    CONSTRAINT pk_revinfo PRIMARY KEY (rev)
);

CREATE TABLE revchanges (
    rev        BIGINT NOT NULL,
    entityname VARCHAR(255),
    CONSTRAINT fk_revchanges_on_default_tracking_modified_entities_changelog FOREIGN KEY (rev) REFERENCES revinfo (rev)
);