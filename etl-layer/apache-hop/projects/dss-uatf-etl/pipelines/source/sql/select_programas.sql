-- Contract 04 v1: approved active academic-program filter.
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
  AND upper(btrim(coalesce(activo, ''))) IN ('1', 'S', 'Y')
ORDER BY id_programa ASC;
