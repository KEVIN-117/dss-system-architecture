-- Contract: docs/dw/source-contracts/07-facultades.md
-- Full catalog snapshot.
SELECT
    id_facultad,
    facultad,
    facu_abre,
    estado
FROM academico.alm_programas_facultades
ORDER BY id_facultad ASC;
