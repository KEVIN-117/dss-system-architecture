-- Contract: docs/dw/source-contracts/08-colegios.md
-- Full catalog snapshot.
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
