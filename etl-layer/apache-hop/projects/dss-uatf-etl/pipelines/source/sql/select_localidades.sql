-- Contract 09 v1: complete locality lookup snapshot.
SELECT
    cod_loc,
    localidad,
    cod_pais,
    cod_dep,
    cod_prov
FROM public.lugar_localidad
ORDER BY cod_loc ASC;
