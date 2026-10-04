SELECT
    id_ra,
    id_sexo,
    estado_civil,
    nac_pais,
    id_colegio,
    id_loc,
    egr_gestion,
    _modificado,
    ?::char(64) AS source_schema_sha256
FROM public.uatf_datos
ORDER BY id_ra ASC;
