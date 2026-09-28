CREATE TABLE public.lugar_localidad (
    cod_loc INTEGER PRIMARY KEY,
    localidad VARCHAR(255),
    cod_pais INTEGER,
    cod_dep INTEGER,
    cod_prov INTEGER
);

INSERT INTO public.lugar_localidad (cod_loc, localidad, cod_pais, cod_dep, cod_prov) VALUES
    (100, 'Localidad Sintetica Norte', 591, 1, 1),
    (101, 'Localidad Sintetica Sur', 591, 1, 2);

GRANT SELECT ON public.lugar_localidad TO dw_fixture_reader;
