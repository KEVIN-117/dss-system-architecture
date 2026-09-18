-- Contract: docs/dw/source-contracts/09-localidades.md
-- Full catalog snapshot.
SELECT
    cod_loc,
    localidad,
    cod_pais,
    cod_dep,
    cod_prov
FROM public.lugar_localidad
ORDER BY cod_loc ASC;
