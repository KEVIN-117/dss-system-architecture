DO $$
BEGIN
    IF (SELECT status FROM etl_control.etl_execution
        WHERE run_id='b1300000-0000-0000-0000-000000000001') <> 'EXITOSA' THEN
        RAISE EXCEPTION 'El workflow Apache Hop no completó publicación y ejecución';
    END IF;
    IF (SELECT count(*) FROM etl_control.etl_execution_step
        WHERE run_id='b1300000-0000-0000-0000-000000000001'
          AND phase='PUBLICACION' AND status='EXITOSO') <> 1 THEN
        RAISE EXCEPTION 'No se registró el paso de publicación exitoso';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_control.etl_execution_lock
        WHERE run_id='b1300000-0000-0000-0000-000000000001'
          AND resource_key='dw:mvp-publication' AND released_at IS NULL) THEN
        RAISE EXCEPTION 'El workflow Hop dejó un lease de publicación activo';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_work.hop_publication_row
        WHERE run_id='b1300000-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'El workflow no limpió el landing tras commit';
    END IF;
END;
$$;
SELECT 'Hop atomic publication workflow passed' AS result;
