INSERT INTO roles (id, name, description)
VALUES
    (1, 'SUPERADMIN', 'Administrador general del sistema'),
    (2, 'RECTOR', 'Rectorado de la universidad'),
    (3, 'DECANO', 'Decanato de una facultad'),
    (4, 'DIRECTOR', 'Dirección de un programa académico')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;
