-- 0053: REFRESH MATERIALIZED VIEW CONCURRENTLY (0052) builds its diff in a
-- temporary table owned by the refreshing role. dw_owner had no TEMPORARY
-- privilege on the database, so every publication failed in
-- mature_hop_retention_labels with "permission denied to create temporary
-- tables". Grant it to dw_owner only (the runtime roles keep no TEMP access).

DO $$
BEGIN
    EXECUTE format('GRANT TEMPORARY ON DATABASE %I TO dw_owner', current_database());
END;
$$;
