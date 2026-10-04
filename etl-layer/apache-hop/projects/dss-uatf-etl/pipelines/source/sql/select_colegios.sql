-- Contract 08 v1: complete school lookup snapshot.
SELECT
    id_colegio,
    colegio,
    tipo,
    turno,
    area,
    cod_loc,
    _estado
FROM public.prs_colegios
ORDER BY id_colegio ASC;
