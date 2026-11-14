-- 0055: repetition (IRE) is only measurable after the first loaded gestión.
--
-- A repeated subject needs an earlier attempt, so in the first gestión loaded
-- in the DW (2015) nobody can be a repeater: IRE showed 44 % vs 72 % in the DSA
-- bulletin. vw_fact_rendimiento_estudiante_olap adds conteo_repite_evaluable,
-- 0 in the first published gestión, used as the IRE denominator.

SET ROLE dw_owner;

CREATE OR REPLACE VIEW dw.vw_fact_rendimiento_estudiante_olap AS
SELECT m.estudiante_sk, m.programa_sk, m.gestion::integer AS gestion,
       m.materias, m.aprobadas, m.reprobadas, m.abandonadas, m.promedio_notas,
       m.conteo_estudiante, m.conteo_aprobado, m.conteo_reprobado, m.conteo_abandono,
       m.conteo_repite, m.conteo_evaluable_retencion, m.conteo_retenido,
       (m.gestion > (SELECT min(x.gestion) FROM dw.mv_rendimiento_estudiante_olap x))::integer::smallint
           AS conteo_repite_evaluable
FROM dw.mv_rendimiento_estudiante_olap m;

RESET ROLE;
