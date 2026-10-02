-- Contract: docs/dw/source-contracts/01-uatf-datos.md
-- Full source-observed snapshot. Metadata parameters are recorded in the staging manifest.
SELECT
    id_ra,
    id_sexo,
    estado_civil,
    nac_pais,
    id_colegio,
    id_loc,
    egr_gestion,
    _modificado
FROM public.uatf_datos
WHERE ($1::varchar IS NULL OR id_ra > $1::varchar)
ORDER BY id_ra ASC
LIMIT $2::integer;
