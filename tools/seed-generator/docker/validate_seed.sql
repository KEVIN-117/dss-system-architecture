-- Validación post-carga del seed OLTP sintético.
-- Uso: psql -v ON_ERROR_STOP=1 -v scenario=decline-growth -f validate_seed.sql
-- Falla (RAISE EXCEPTION) ante cualquier violación de integridad o de narrativa.

\echo '== Integridad referencial y de dominio'
DO $$
DECLARE
  v bigint;
  failures text[] := '{}';
BEGIN
  IF current_database() <> 'jachasun_test' THEN
    RAISE EXCEPTION 'Validación solo permitida en jachasun_test (actual: %)', current_database();
  END IF;

  SELECT count(*) INTO v FROM academico.alumnos a
  WHERE NOT EXISTS (SELECT 1 FROM public.uatf_datos d WHERE d.id_ra = a.id_ra);
  IF v > 0 THEN failures := failures || format('%s alumnos sin uatf_datos', v); END IF;

  SELECT count(*) INTO v FROM public.postulantes p
  WHERE NOT EXISTS (SELECT 1 FROM public.uatf_datos d WHERE d.id_ra = p.id_ra);
  IF v > 0 THEN failures := failures || format('%s postulantes sin uatf_datos', v); END IF;

  SELECT count(*) INTO v FROM academico.notas_planilla n
  WHERE NOT EXISTS (
    SELECT 1 FROM academico.alm_programaciones p
    WHERE p.id_alumno = n.id_alumno AND p.id_materia = n.id_materia
      AND p.id_gestion = n.id_gestion AND p.id_periodo = n.id_periodo);
  IF v > 0 THEN failures := failures || format('%s notas sin programación', v); END IF;

  SELECT count(*) INTO v FROM academico.notas_planilla n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matriculas m
    WHERE m.id_alumno = n.id_alumno AND m.id_gestion = n.id_gestion AND m.id_periodo = n.id_periodo);
  IF v > 0 THEN failures := failures || format('%s notas sin matrícula del periodo', v); END IF;

  SELECT count(*) INTO v FROM academico.notas_planilla n
  JOIN academico.alumnos a USING (id_alumno)
  JOIN academico.alm_programas p ON p.id_programa = a.id_programa
  WHERE p.tipo = 'A' AND n.id_periodo <> 1;
  IF v > 0 THEN failures := failures || format('%s notas anuales fuera del periodo 1', v); END IF;

  SELECT count(*) INTO v FROM actas_graduacion.graduados g
  JOIN academico.alumnos a USING (id_alumno)
  JOIN public.uatf_datos d ON d.id_ra = a.id_ra
  WHERE d.nro_dip IS DISTINCT FROM trim(g.nro_dip) OR a.estado <> 'T';
  IF v > 0 THEN failures := failures || format('%s titulados inconsistentes', v); END IF;

  SELECT count(*) INTO v FROM academico.notas_planilla
  WHERE greatest(nota, nota_2da, nota_ex_mesa) NOT BETWEEN 0 AND 100;
  IF v > 0 THEN failures := failures || format('%s notas fuera de 0-100', v); END IF;

  SELECT count(*) INTO v FROM academico.pln_materias WHERE coalesce(_creditos, 0) <= 0;
  IF v > 0 THEN failures := failures || format('%s materias sin créditos', v); END IF;

  IF array_length(failures, 1) > 0 THEN
    RAISE EXCEPTION 'Integridad del seed: %', array_to_string(failures, '; ');
  END IF;
  RAISE NOTICE 'Integridad OK';
END $$;

\echo '== KPIs observados por gestión (desde las tablas OLTP cargadas)'
CREATE TEMP VIEW seed_kpi AS
WITH post AS (
  SELECT id_gestion AS gestion, count(*) AS postulantes, count(*) FILTER (WHERE estado = 'A') AS admitidos
  FROM public.postulantes GROUP BY 1
), mat AS (
  SELECT id_gestion AS gestion, count(DISTINCT id_alumno) AS estudiantes_matriculados
  FROM public.matriculas GROUP BY 1
), cur AS (
  SELECT id_gestion AS gestion,
         count(*) AS cursados,
         count(*) FILTER (WHERE greatest(nota, nota_2da, nota_ex_mesa) >= 51) AS aprobados,
         count(*) FILTER (WHERE greatest(nota, nota_2da, nota_ex_mesa) > 0) AS con_nota,
         count(*) FILTER (WHERE estado = 'X') AS abandonos,
         round(avg(nullif(greatest(nota, nota_2da, nota_ex_mesa), 0)), 1) AS nota_media
  FROM academico.notas_planilla GROUP BY 1
), tit AS (
  SELECT id_gestion AS gestion, count(*) AS titulados FROM actas_graduacion.graduados GROUP BY 1
)
SELECT post.gestion, postulantes, admitidos,
       round(100.0 * admitidos / nullif(postulantes, 0), 1) AS pct_admision,
       coalesce(estudiantes_matriculados, 0) AS matriculados,
       coalesce(cursados, 0) AS cursados,
       round(100.0 * aprobados / nullif(con_nota, 0), 1) AS pct_aprobacion,
       nota_media,
       coalesce(abandonos, 0) AS abandonos,
       coalesce(titulados, 0) AS titulados
FROM post
LEFT JOIN mat USING (gestion)
LEFT JOIN cur USING (gestion)
LEFT JOIN tit USING (gestion)
ORDER BY gestion;

SELECT * FROM seed_kpi;

SELECT :'scenario' = 'decline-growth' AS expect_trend \gset
\if :expect_trend
\echo '== Narrativa decline-growth: declive 2010-2015, crecimiento 2016-actual'
DO $$
DECLARE
  slope_post_decline numeric;
  slope_post_growth numeric;
  slope_pass_decline numeric;
  slope_pass_growth numeric;
  enrolled_floor int;
  enrolled_2009 int;
  enrolled_last int;
BEGIN
  SELECT regr_slope(postulantes, gestion) INTO slope_post_decline FROM seed_kpi WHERE gestion BETWEEN 2010 AND 2015;
  SELECT regr_slope(postulantes, gestion) INTO slope_post_growth FROM seed_kpi WHERE gestion >= 2016;
  SELECT regr_slope(pct_aprobacion, gestion) INTO slope_pass_decline FROM seed_kpi WHERE gestion BETWEEN 2010 AND 2015;
  SELECT regr_slope(pct_aprobacion, gestion) INTO slope_pass_growth FROM seed_kpi WHERE gestion >= 2016;
  SELECT min(matriculados) INTO enrolled_floor FROM seed_kpi WHERE gestion BETWEEN 2014 AND 2018;
  SELECT matriculados INTO enrolled_2009 FROM seed_kpi WHERE gestion = 2009;
  SELECT matriculados INTO enrolled_last FROM seed_kpi ORDER BY gestion DESC LIMIT 1;

  RAISE NOTICE 'Pendiente postulantes 2010-2015: % | 2016+: %', round(slope_post_decline, 2), round(slope_post_growth, 2);
  RAISE NOTICE 'Pendiente %% aprobación 2010-2015: % | 2016+: %', round(slope_pass_decline, 2), round(slope_pass_growth, 2);
  RAISE NOTICE 'Matriculados 2009: % | piso 2014-2018: % | última gestión: %', enrolled_2009, enrolled_floor, enrolled_last;

  IF slope_post_decline >= 0 THEN RAISE EXCEPTION 'Narrativa: la demanda no cae en 2010-2015'; END IF;
  IF slope_post_growth <= 0 THEN RAISE EXCEPTION 'Narrativa: la demanda no crece desde 2016'; END IF;
  IF slope_pass_decline >= 0 THEN RAISE EXCEPTION 'Narrativa: el rendimiento no cae en 2010-2015'; END IF;
  IF slope_pass_growth <= 0 THEN RAISE EXCEPTION 'Narrativa: el rendimiento no mejora desde 2016'; END IF;
  IF enrolled_last <= enrolled_floor THEN RAISE EXCEPTION 'Narrativa: la matrícula no se recupera'; END IF;
  RAISE NOTICE 'Narrativa decline-growth OK';
END $$;
\endif
