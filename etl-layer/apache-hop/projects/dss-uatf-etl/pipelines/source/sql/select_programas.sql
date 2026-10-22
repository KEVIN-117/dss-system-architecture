-- Contract 04 v3: Jachasun confirms activo = 'A' means active.
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
WHERE upper(btrim(_tipo_academico)) IN ('CAR', 'PRO', 'TES', 'TEM')
  AND upper(btrim(coalesce(activo, ''))) = 'A'
ORDER BY id_programa ASC;
