-- 0049: the OLAP "Periodo" dimension lists only cuts with published facts.
--
-- vw_dim_periodo_olap (0047) exposed the technical UNKNOWN/NOT_APPLICABLE
-- members as "Sin gestión" and every closure created in advance (2002-2014)
-- without data. Portals pick the last member as the default cut, so the rector
-- dashboard opened on "Sin gestión" with empty indicators. Facts never point
-- to those members (checked on the loaded DW), so filtering them is safe.

SET ROLE dw_owner;

CREATE OR REPLACE VIEW dw.vw_dim_periodo_olap AS
SELECT pa.periodo_academico_sk,
       coalesce(pa.gestion, 0)::smallint AS gestion,
       coalesce(pa.gestion::text, 'Sin gestión') AS gestion_nombre,
       coalesce(pa.periodo, 0)::smallint AS periodo,
       CASE WHEN pa.periodo IS NULL THEN 'Sin periodo' ELSE 'Periodo ' || pa.periodo END AS periodo_nombre
FROM dw.dim_periodo_academico pa
WHERE pa.member_type = 'STANDARD'
  AND (EXISTS (SELECT 1 FROM dw.fact_cursado f WHERE f.periodo_academico_sk = pa.periodo_academico_sk)
       OR EXISTS (SELECT 1 FROM dw.fact_admision f WHERE f.periodo_academico_sk = pa.periodo_academico_sk)
       OR EXISTS (SELECT 1 FROM dw.fact_retencion_desercion f WHERE f.periodo_academico_sk = pa.periodo_academico_sk));

COMMENT ON VIEW dw.vw_dim_periodo_olap IS
    '0049: OLAP period dimension, standard cuts with at least one published fact.';

RESET ROLE;
