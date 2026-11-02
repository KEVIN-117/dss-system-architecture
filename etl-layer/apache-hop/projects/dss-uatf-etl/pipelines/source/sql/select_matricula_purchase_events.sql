-- Contract 10: matrícula purchase events through the requested academic cut.
-- JDBC parameters: gestion (smallint), periodo (smallint).
--
-- Grain: one row per public.cajas_transacciones.id_transaccion.
-- `valores_transacciones.id_caja_tran` is the direct transaction reference.
-- The OLTP has no consistent transaction FK on public.matriculas, so those
-- rows are associated only when student, management and transaction timestamp
-- match exactly. A semester-1 purchase may therefore return both period rows,
-- while remaining one purchase event.
WITH params AS (
    SELECT ?::smallint AS gestion, ?::smallint AS periodo
), purchase_transactions AS (
    SELECT
        ct.id_transaccion,
        ct.id_alumno,
        ct.id_gestion,
        ct.id_periodo,
        ct.id_tipo_transaccion,
        ct.estado,
        ct.id_cargo,
        ct.costo,
        ct.fec_transaccion,
        ct.fec_pago
    FROM public.cajas_transacciones ct
    CROSS JOIN params p
    WHERE ct.id_tipo_transaccion = 7
      AND ct.estado = 'A'
      AND ct.id_alumno IS NOT NULL
      AND ct.id_gestion IS NOT NULL
      AND ct.id_periodo IS NOT NULL
      AND (ct.id_gestion, ct.id_periodo) <= (p.gestion, p.periodo)
), transaction_details AS (
    SELECT
        vt.id_caja_tran,
        vt.id_alumno,
        vt.id_gestion,
        vt.id_periodo,
        count(*)::integer AS detail_row_count,
        sum(vt.costo)::numeric(14,2) AS detail_amount,
        array_agg(DISTINCT btrim(vt.id_programa) ORDER BY btrim(vt.id_programa)) AS program_refs
    FROM public.valores_transacciones vt
    WHERE vt.id_caja_tran IS NOT NULL
      AND vt.id_tipo_transaccion = 7
      AND vt.estado = 'A'
    GROUP BY vt.id_caja_tran, vt.id_alumno, vt.id_gestion, vt.id_periodo
), matched_enrollments AS (
    SELECT
        tx.id_transaccion,
        count(m.id_matricula)::integer AS enrollment_row_count,
        array_agg(m.id_matricula ORDER BY m.id_periodo, m.id_matricula) AS enrollment_ids,
        array_agg(DISTINCT m.id_periodo ORDER BY m.id_periodo) AS enrollment_periods,
        array_agg(DISTINCT m.clave ORDER BY m.clave) FILTER (WHERE m.clave IS NOT NULL) AS enrollment_keys
    FROM purchase_transactions tx
    JOIN public.matriculas m
      ON m.id_alumno = tx.id_alumno
     AND m.id_gestion = tx.id_gestion
     AND m._registrado = tx.fec_pago
     AND m.estado = 'A'
    GROUP BY tx.id_transaccion
)
SELECT
    tx.id_transaccion AS purchase_event_id,
    tx.id_alumno,
    tx.id_gestion,
    tx.id_periodo AS transaction_period,
    tx.id_tipo_transaccion,
    tx.estado AS transaction_status,
    tx.id_cargo,
    tx.costo AS transaction_amount,
    tx.fec_transaccion,
    tx.fec_pago AS transaction_timestamp,
    coalesce(d.detail_row_count, 0) AS detail_row_count,
    d.detail_amount,
    d.program_refs,
    coalesce(e.enrollment_row_count, 0) AS matched_enrollment_row_count,
    coalesce(e.enrollment_ids, ARRAY[]::integer[]) AS matched_enrollment_ids,
    coalesce(e.enrollment_periods, ARRAY[]::smallint[]) AS matched_enrollment_periods,
    coalesce(e.enrollment_keys, ARRAY[]::varchar[]) AS matched_enrollment_keys,
    CASE
        WHEN coalesce(e.enrollment_row_count, 0) = 0 THEN 'SIN_COINCIDENCIA_EXACTA'
        WHEN coalesce(d.detail_row_count, 0) = 0 THEN 'MATRICULA_SIN_DETALLE'
        WHEN coalesce(d.detail_row_count, 0) > 0 THEN 'COINCIDENCIA_POR_TRANSACCION_Y_TIMESTAMP'
    END AS reconciliation_status,
    'id_caja_tran + alumno + gestion + periodo'::varchar AS detail_match_rule,
    'alumno + gestion + _registrado = fec_pago'::varchar AS enrollment_match_rule
FROM purchase_transactions tx
LEFT JOIN transaction_details d
  ON d.id_caja_tran = tx.id_transaccion
 AND d.id_alumno = tx.id_alumno
 AND d.id_gestion = tx.id_gestion
 AND d.id_periodo = tx.id_periodo
LEFT JOIN matched_enrollments e ON e.id_transaccion = tx.id_transaccion
ORDER BY tx.id_gestion, tx.id_periodo, tx.id_alumno, tx.fec_pago, tx.id_transaccion;
