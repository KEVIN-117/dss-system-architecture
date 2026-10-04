CREATE TABLE public.postulantes (
    id_alumno INTEGER NOT NULL UNIQUE,
    id_ra VARCHAR(10) NOT NULL,
    id_programa CHAR(3) NOT NULL,
    id_gestion SMALLINT,
    id_periodo SMALLINT,
    id_acceso CHAR(2),
    nota INTEGER,
    estado CHAR(1),
    fec_inscripcion DATE,
    _modificado TIMESTAMP NOT NULL
);

INSERT INTO public.postulantes (
    id_alumno, id_ra, id_programa, id_gestion, id_periodo, id_acceso, nota, estado,
    fec_inscripcion, _modificado
) VALUES
    (1001, 'RA-T001', 'P01', 2025, 1, '01', 80, 'A', '2025-01-10', '2025-01-11 09:00:00'),
    (1002, 'RA-T002', 'P01', 2025, 1, '02', NULL, 'P', '2025-01-11', '2025-01-12 09:00:00'),
    (1003, 'RA-T003', 'P02', 2025, 2, '01', 76, 'A', '2025-07-10', '2025-07-11 09:00:00');

GRANT SELECT ON public.postulantes TO dw_fixture_reader;
