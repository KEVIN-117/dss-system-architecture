CREATE TABLE public.uatf_datos (
    id_ra VARCHAR(10) PRIMARY KEY,
    id_sexo VARCHAR(1),
    estado_civil SMALLINT,
    nac_pais INTEGER,
    id_colegio INTEGER,
    id_loc INTEGER,
    egr_gestion SMALLINT,
    _modificado TIMESTAMP NOT NULL
);

INSERT INTO public.uatf_datos (
    id_ra, id_sexo, estado_civil, nac_pais, id_colegio, id_loc, egr_gestion, _modificado
) VALUES
    ('RA-T001', 'F', 1, 591, 10, 100, 2020, '2025-12-01 10:00:00'),
    ('RA-T003', 'M', NULL, 591, 11, 101, NULL, '2025-12-01 10:00:00');

GRANT SELECT ON public.uatf_datos TO dw_fixture_reader;
