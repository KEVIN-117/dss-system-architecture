#!/bin/sh
set -eu

source_psql() {
    PGPASSWORD="$SOURCE_PASSWORD" psql -X -v ON_ERROR_STOP=1 \
        -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" "$@"
}

target_psql() {
    PGPASSWORD="$TARGET_PASSWORD" psql -X -v ON_ERROR_STOP=1 \
        -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$TARGET_DB" "$@"
}

assert_olap_connection_budget() {
    expected_limit=20
    max_connections=$(target_psql -Atqc "SHOW max_connections;")
    if [ "$max_connections" != '100' ]; then
        echo "Disposable DW max_connections mismatch: expected=100 actual=$max_connections" >&2
        exit 1
    fi
    actual_limit=$(target_psql -Atqc "SELECT rolconnlimit FROM pg_roles WHERE rolname = 'olap_test';")
    if [ "$actual_limit" != "$expected_limit" ]; then
        echo "OLAP role connection limit mismatch: expected=$expected_limit actual=$actual_limit" >&2
        exit 1
    fi

    echo 'Checking the disposable OLAP PostgreSQL connection budget (20 sessions)'
    pids=''
    cleanup_olap_sessions() {
        for pid in $pids; do
            kill "$pid" >/dev/null 2>&1 || true
        done
        wait >/dev/null 2>&1 || true
    }
    trap cleanup_olap_sessions EXIT HUP INT TERM

    i=0
    while [ "$i" -lt "$expected_limit" ]; do
        PGPASSWORD=olap_test psql -X -v ON_ERROR_STOP=1 \
            -h "$TARGET_HOST" -p "$TARGET_PORT" -U olap_test -d "$TARGET_DB" \
            -c 'SELECT pg_sleep(30);' >/dev/null 2>&1 &
        pids="$pids $!"
        i=$((i + 1))
    done

    attempts=0
    while [ "$attempts" -lt 40 ]; do
        active=$(target_psql -Atqc "SELECT count(*) FROM pg_stat_activity WHERE usename = 'olap_test';")
        if [ "$active" = "$expected_limit" ]; then
            break
        fi
        sleep 0.25
        attempts=$((attempts + 1))
    done
    if [ "$active" != "$expected_limit" ]; then
        echo "Could not establish the OLAP budget: expected=$expected_limit active=$active" >&2
        exit 1
    fi

    if PGPASSWORD=olap_test psql -X -v ON_ERROR_STOP=1 \
        -h "$TARGET_HOST" -p "$TARGET_PORT" -U olap_test -d "$TARGET_DB" \
        -c 'SELECT 1;' >/dev/null 2>&1; then
        echo 'OLAP role unexpectedly opened a 21st PostgreSQL session' >&2
        exit 1
    fi

    cleanup_olap_sessions
    trap - EXIT HUP INT TERM
}

assert_source_count() {
    table_name=$1
    expected=$2
    actual=$(source_psql -Atqc "SELECT count(*) FROM $table_name;")
    if [ "$actual" != "$expected" ]; then
        echo "Source count mismatch for $table_name: expected=$expected actual=$actual" >&2
        exit 1
    fi
}

assert_target_count() {
    description=$1
    query=$2
    expected=$3
    actual=$(target_psql -Atqc "$query")
    if [ "$actual" != "$expected" ]; then
        echo "Target assertion failed for $description: expected=$expected actual=$actual" >&2
        exit 1
    fi
}

echo 'Checking synthetic source counts'
assert_source_count public.uatf_datos 2002
assert_source_count academico.alumnos 3
assert_source_count public.postulantes 4
assert_source_count academico.alm_programas 2
assert_source_count academico.alm_programas_facultades 2
assert_source_count academico.pln_materias 3
assert_source_count academico.notas_planilla 6

expected_cases=$(grep -h -c '^[[:space:]]*-[[:space:]]*case_code:' \
    /fixtures/expected/scd2-cases.yml \
    /fixtures/expected/closure-cases.yml \
    /fixtures/expected/quality-cases.yml | awk '{total += $1} END {print total}')
if [ "$expected_cases" != '10' ]; then
    echo "Expected case catalog mismatch: expected=10 actual=$expected_cases" >&2
    exit 1
fi

echo 'Checking source contracts and quality cases'
source_psql -Atqc "SELECT id_alumno FROM academico.alumnos WHERE id_alumno = 1002 AND id_ra IS NULL;" | grep -qx '1002'
source_psql -Atqc "SELECT count(*) FROM academico.notas_planilla WHERE nota < 0 OR nota > 100;" | grep -qx '1'
grep -c 'expected_result: BLOCK' /fixtures/expected/quality-cases.yml | grep -qx '2'
source_psql -Atqc "SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('public','academico') AND column_name ~* '(nombre|documento|telefono|correo|email|direccion|fecha_nacimiento)';" | grep -qx '0'

echo 'Checking source read-only boundary'
if source_psql -c 'CREATE TABLE public.dw008_should_fail (id integer);' >/dev/null 2>&1; then
    echo 'Source fixture reader unexpectedly has DDL privileges' >&2
    exit 1
fi

echo 'Checking DW migrations and technical members'
assert_olap_connection_budget
assert_target_count 'migration history' \
    "SELECT count(*) FROM etl_control.schema_migration WHERE version IN ('0001','0002','0003','0004','0005','0006','0007','0008','0009','0010','0011','0012','0013','0014','0015','0016','0017','0018','0019','0020');" 20
assert_target_count 'conformed dimensions' \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'dw' AND table_name IN ('dim_estudiante','dim_programa','dim_materia','dim_periodo_academico','dim_admision');" 5
assert_target_count 'technical dimension members' \
    "SELECT count(*) FROM (SELECT estudiante_sk AS sk FROM dw.dim_estudiante UNION ALL SELECT programa_sk FROM dw.dim_programa UNION ALL SELECT materia_sk FROM dw.dim_materia UNION ALL SELECT periodo_academico_sk FROM dw.dim_periodo_academico UNION ALL SELECT admision_sk FROM dw.dim_admision) members WHERE sk IN (-1, 0);" 10
assert_target_count 'uatf_datos RAW target' \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'staging' AND table_name = 'raw_uatf_datos';" 1
assert_target_count 'RAW append-only writer privileges' \
    "SELECT count(*) FROM (SELECT has_table_privilege('dw_staging_writer', 'staging.raw_uatf_datos', 'SELECT') AS can_read, has_table_privilege('dw_staging_writer', 'staging.raw_uatf_datos', 'INSERT') AS can_insert, has_table_privilege('dw_staging_writer', 'staging.raw_uatf_datos', 'UPDATE') AS can_update, has_table_privilege('dw_staging_writer', 'staging.raw_uatf_datos', 'DELETE') AS can_delete) rights WHERE can_read AND can_insert AND NOT can_update AND NOT can_delete;" 1
assert_target_count 'RAW historical rows preserved under NOT VALID check' \
    "SELECT count(*) FROM pg_constraint WHERE conrelid = 'staging.raw_uatf_datos'::regclass AND conname = 'ck_raw_uatf_datos_required_fields' AND NOT convalidated;" 1

echo 'Registering synthetic run and manifest'
target_psql <<'SQL'
SET ROLE dw_staging_writer;
SELECT etl_control.create_etl_execution(
    '88888888-8888-8888-8888-888888888888'::uuid,
    'HISTORICA'::varchar(24),
    'integration-test:dw-008'::varchar(255)
);
SELECT etl_control.register_etl_source_manifest(
    '88888888-8888-8888-8888-888888888888'::uuid,
    'public.uatf_datos'::varchar(150), 'v1'::varchar(64),
    'public'::varchar(63), 'uatf_datos'::varchar(63),
    repeat('a', 64)::char(64), 'id_ra ASC'::text,
    'COMPLETO'::varchar(16), repeat('b', 64)::char(64),
    2025::smallint, 2::smallint, '2025-12-15 18:00:00+00'::timestamptz,
    2::bigint
);
SELECT etl_control.record_etl_execution_metric(
    '88888888-8888-8888-8888-888888888888'::uuid,
    'source_rows_observed'::varchar(100), 2::numeric,
    'ROWS'::varchar(32), NULL, '{}'::jsonb
);
RESET ROLE;
SQL

assert_target_count 'synthetic run' \
    "SELECT count(*) FROM etl_control.etl_execution WHERE run_id = '88888888-8888-8888-8888-888888888888';" 1
assert_target_count 'complete source manifest' \
    "SELECT count(*) FROM etl_control.etl_source_manifest WHERE run_id = '88888888-8888-8888-8888-888888888888' AND status = 'COMPLETO';" 1
assert_target_count 'run metric' \
    "SELECT count(*) FROM etl_control.etl_execution_metric WHERE run_id = '88888888-8888-8888-8888-888888888888' AND metric_name = 'source_rows_observed';" 1

echo 'Checking fixture hashes'
assert_file_hash() {
    file_path=$1
    expected_hash=$2
    # Git may check these fixtures out with CRLF on Windows; the manifest hashes
    # canonical LF content so validation is stable across developer platforms.
    actual_hash=$(tr -d '\r' < "$file_path" | sha256sum | awk '{print $1}')
    if [ "$actual_hash" != "$expected_hash" ]; then
        echo "Fixture checksum mismatch for $file_path: expected=$expected_hash actual=$actual_hash" >&2
        exit 1
    fi
}

echo 'Creating reversible synthetic academic closures for the Hop dimensional-preparation test'
target_psql <<'SQL'
INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES
    (2025, 1, 'integration-test:fixture', 'Synthetic closure for DIM_PERIODO_ACADEMICO'),
    (2025, 2, 'integration-test:fixture', 'Synthetic closure for DIM_PERIODO_ACADEMICO'),
    (2025, 3, 'integration-test:fixture', 'Synthetic closure for SCD2 unchanged-snapshot test');
SELECT etl_control.transition_academic_period_closure(
    2025::smallint, 1::smallint, 'CERRADO'::varchar(16), 'dsa:integration-fixture'::varchar(255),
    'Synthetic authorized closure for integration only', clock_timestamp() - interval '180 days'
);
SELECT etl_control.transition_academic_period_closure(
    2025::smallint, 2::smallint, 'CERRADO'::varchar(16), 'dsa:integration-fixture'::varchar(255),
    'Synthetic authorized closure for integration only', clock_timestamp() - interval '90 days'
);
SELECT etl_control.transition_academic_period_closure(
    2025::smallint, 3::smallint, 'CERRADO'::varchar(16), 'dsa:integration-fixture'::varchar(255),
    'Synthetic authorized closure for unchanged SCD2 replay', clock_timestamp() - interval '30 days'
);
SQL

assert_file_hash /fixtures/source/alm_programas.sql 2f8460b6ac83f402dd417b3280298850d76912946473bdf2ae50aaa3ef9f4688
assert_file_hash /fixtures/source/alm_programas_facultades.sql 5994f8097179bdc92a8bcf4a034a5767d97373a55881cb0c3bb1ff0002149197
assert_file_hash /fixtures/source/alumnos.sql 1a6d5dfea45e2a1d7b01e55275879506b61f62639521f7c8620c65d81796ee9f
assert_file_hash /fixtures/source/lugar_localidad.sql e48302f047217cc1b02ee720678ab97fc65d3f212d11405fe0e95639addd322f
assert_file_hash /fixtures/source/notas_planilla.sql c6cc589b189bc76d9e14b27ab5742fb014a805b3e6f7220c876f3c074fe7ea96
assert_file_hash /fixtures/source/pln_materias.sql 58b71982f1ef9ad495a22c23422da9958d3576f84f5af75b2e46f3be2f307efd
assert_file_hash /fixtures/source/postulantes.sql f9cba446015f59e3bda6c506e1d0066ac2aba8a831cbea0aeba1b5c4c8dfda54
assert_file_hash /fixtures/source/prs_colegios.sql b7d9b8a0f208bd3cc28180bbe07e9441b1aee6e702170032f06c1f60d16ed1ea
assert_file_hash /fixtures/source/uatf_datos.sql cbecc161b0f98b314fb166bbb856afc54fbe1596663473fed83398ee33ca1028
assert_file_hash /fixtures/expected/scd2-cases.yml 0efe7aec63e30d22c137cac05949a142dcde543ebee60f02f98170ebeb910a85
assert_file_hash /fixtures/expected/closure-cases.yml 94d7ebc2ee8feaa1fe9e7df945754b77eaa61a70dbd4106fa10c3f5e5dbf5afe
assert_file_hash /fixtures/expected/quality-cases.yml e7dffe9d18e686b9cdb8cc32de9d7c512fa8662d7871ff8fecfa9a74884de7d6
echo 'Provisioning restricted Load Manager test principal'
target_psql -c "CREATE ROLE loadmanager_test LOGIN PASSWORD 'loadmanager_test' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION"
target_psql -c 'GRANT dw_staging_writer TO loadmanager_test'
echo 'Provisioning restricted Apache Hop vertical-flow test principal'
target_psql -c "CREATE ROLE hop_vertical_test LOGIN PASSWORD 'hop_vertical_test' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION"
target_psql -c 'GRANT dw_hop_runtime TO hop_vertical_test'
echo 'Checking that an empty DIM_ADMISION snapshot can be sealed'
PGPASSWORD=hop_vertical_test psql -X -v ON_ERROR_STOP=1 \
    -h "$TARGET_HOST" -p "$TARGET_PORT" -U hop_vertical_test -d "$TARGET_DB" <<'SQL'
BEGIN;
SELECT etl_control.create_hop_etl_execution(
    'd1300000-0000-0000-0000-000000000001'::uuid,
    'HISTORICA'::varchar(24), NULL::bigint, NULL::smallint, NULL::smallint,
    NULL::timestamptz, NULL::uuid, 'Empty DIM_ADMISION batch regression test'::text
);
SELECT etl_control.start_hop_etl_execution(
    'd1300000-0000-0000-0000-000000000001'::uuid, 'Start empty dimension regression test'
);
DO $$
DECLARE
    v_rows BIGINT;
BEGIN
    v_rows := etl_control.seal_hop_admission_dimension_batch(
        'd1300000-0000-0000-0000-000000000001'::uuid
    );
    IF v_rows <> 0 THEN
        RAISE EXCEPTION 'Expected DIM_ADMISION zero-row batch to seal with count 0, got %', v_rows;
    END IF;
END;
$$;
ROLLBACK;
SQL
sha256sum /fixtures/source/*.sql /fixtures/expected/*.yml
echo 'DW-011 integration test passed'
