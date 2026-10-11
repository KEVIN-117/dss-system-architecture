\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Compatibility repair for the first local seed revision only. On a fresh database,
-- seed_historical.sql already creates these cases, and this statement becomes a no-op.
-- It can only touch rows carrying the reserved synthetic IDs, actor/hash and marker.
WITH candidates AS (
    SELECT n.id_matricula,
           CASE WHEN right(a.id_ra, 6)::integer % 200=1 THEN 0 ELSE 1 END AS partial_count
    FROM academico.notas_planilla n
    JOIN academico.alumnos a ON a.id_alumno=n.id_alumno
    JOIN academico.pln_materias m ON m.id_materia=n.id_materia
    WHERE a.id_ra ~ '^TEST[0-9]{6}$'
      AND right(a.id_ra, 6)::integer % 200 IN (1,101)
      AND n.id_matricula BETWEEN 100000000 AND 109999999
      AND n.ult_usuario='DW_TEST_SEED'
      AND n._hash='DWTESTV1'
      AND n.observacion='DW_TEST_SEED_V1:normal'
      AND n.id_gestion=extract(year FROM a.fec_inscripcion)::smallint
      AND m.id_programa=a.id_programa
      AND m.ciclo=1
      AND m.materia LIKE '%ASIGNATURA 1'
)
UPDATE academico.notas_planilla n
SET nota=NULL,
    nota_2da=NULL,
    nota_ex_mesa=NULL,
    estado='X',
    pparcial=CASE WHEN c.partial_count=1 THEN 50::numeric ELSE NULL END,
    sparcial=NULL,
    tparcial=NULL,
    cparcial=NULL,
    observacion='DW_TEST_SEED_V1:abandono_lt2_parciales_'||c.partial_count
FROM candidates c
WHERE n.id_matricula=c.id_matricula;

UPDATE public.uatf_datos
SET nacionalidad=NULL
WHERE id_ra ~ '^TEST[0-9]{6}$'
  AND _id_usuario='DW_TEST_SEED'
  AND nacionalidad='BOLIVIANO';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM academico.notas_planilla WHERE observacion='DW_TEST_SEED_V1:abandono_lt2_parciales_0') OR
       NOT EXISTS (SELECT 1 FROM academico.notas_planilla WHERE observacion='DW_TEST_SEED_V1:abandono_lt2_parciales_1') THEN
        RAISE EXCEPTION 'Could not establish both controlled 0/1 partial test cases';
    END IF;
END $$;
COMMIT;

SELECT observacion, count(*) AS rows
FROM academico.notas_planilla
WHERE observacion IN ('DW_TEST_SEED_V1:abandono_lt2_parciales_0',
                      'DW_TEST_SEED_V1:abandono_lt2_parciales_1')
GROUP BY observacion
ORDER BY observacion;
