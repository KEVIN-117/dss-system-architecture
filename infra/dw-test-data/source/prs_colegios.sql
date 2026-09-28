CREATE TABLE public.prs_colegios (
    id_colegio INTEGER PRIMARY KEY,
    colegio VARCHAR(65) NOT NULL,
    tipo CHAR(1) NOT NULL,
    turno CHAR(1) NOT NULL,
    area CHAR(1) NOT NULL,
    cod_loc SMALLINT NOT NULL,
    _estado CHAR(1) NOT NULL
);

INSERT INTO public.prs_colegios (id_colegio, colegio, tipo, turno, area, cod_loc, _estado) VALUES
    (10, 'Colegio Sintetico Norte', 'P', 'D', 'U', 100, 'A'),
    (11, 'Colegio Sintetico Sur', 'F', 'M', 'R', 101, 'A');

GRANT SELECT ON public.prs_colegios TO dw_fixture_reader;
