-- Ejecutado por postgres al iniciar el contenedor
-- (montado en /docker-entrypoint-initdb.d/)

-- Esquema para Keycloak (separado del auth-service)
CREATE SCHEMA IF NOT EXISTS keycloak;

-- Usuario dedicado para Keycloak (principio de mínimo privilegio)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak_user') THEN
    CREATE ROLE keycloak_user WITH LOGIN PASSWORD 'change-in-production';
  END IF;
END
$$;

-- Permisos: Keycloak solo ve su esquema
GRANT USAGE, CREATE ON SCHEMA keycloak TO keycloak_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA keycloak
  GRANT ALL ON TABLES TO keycloak_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA keycloak
  GRANT ALL ON SEQUENCES TO keycloak_user;

-- El auth-service sigue usando el schema public
-- (o crear schema auth_service si se prefiere)