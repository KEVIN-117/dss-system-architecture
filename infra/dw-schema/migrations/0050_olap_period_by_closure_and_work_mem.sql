-- 0050: keep OLAP queries under the 60 s datasource timeout.
--
-- * 0049 filtered vw_dim_periodo_olap with EXISTS over the three fact tables.
--   Mondrian joins that view in every segment query, and the EXISTS probes on
--   fact_admision / fact_retencion_desercion (no period index) took ~90 s,
--   so every report query timed out. A period is published exactly when its
--   closure has been processed (PROCESADO, or REABIERTO with its previous
--   publication still in place), which is a 40-row lookup.
-- * count(distinct estudiante_sk) over fact_cursado (privacy count and
--   "Estudiantes") sorted 1.18M rows on disk with the default work_mem.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_olap_runtime') THEN
        ALTER ROLE dw_olap_runtime SET work_mem = '128MB';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE VIEW dw.vw_dim_periodo_olap AS
SELECT pa.periodo_academico_sk,
       coalesce(pa.gestion, 0)::smallint AS gestion,
       coalesce(pa.gestion::text, 'Sin gestión') AS gestion_nombre,
       coalesce(pa.periodo, 0)::smallint AS periodo,
       CASE WHEN pa.periodo IS NULL THEN 'Sin periodo' ELSE 'Periodo ' || pa.periodo END AS periodo_nombre
FROM dw.dim_periodo_academico pa
JOIN etl_control.academic_period_closure c ON c.closure_id = pa.closure_id
WHERE pa.member_type = 'STANDARD'
  AND (c.status = 'PROCESADO' OR (c.status = 'REABIERTO' AND c.processed_run_id IS NOT NULL));

COMMENT ON VIEW dw.vw_dim_periodo_olap IS
    '0050: OLAP period dimension, standard cuts whose closure has a publication.';

RESET ROLE;
