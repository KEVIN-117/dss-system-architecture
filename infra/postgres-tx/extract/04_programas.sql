-- Contract: docs/dw/source-contracts/04-programas.md
-- Full catalog snapshot with the approved institutional scope filter.
SELECT
    id_programa,
    programa,
    id_facultad,
    id_nivel,
    nivel,
    sede,
    _tipo_academico,
    activo
FROM academico.alm_programas
WHERE TRIM(UPPER(_tipo_academico)) IN ('CAR', 'PRO', 'TES', 'TEM')
  AND TRIM(UPPER(COALESCE(activo, ''))) IN ('1', 'S', 'Y')
ORDER BY id_programa ASC;
