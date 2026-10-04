-- Contract 07 v1: complete faculty lookup snapshot.
SELECT
    id_facultad,
    facultad,
    facu_abre,
    estado
FROM academico.alm_programas_facultades
ORDER BY id_facultad ASC;
