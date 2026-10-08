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
assert_source_count academico.notas_planilla 5

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
    "SELECT count(*) FROM etl_control.schema_migration WHERE version IN ('0001','0002','0003','0004','0005','0006','0007');" 7
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

assert_file_hash /fixtures/source/alm_programas.sql 37cff404c6c4d5d7e25b7c69293943734f55ec1a5f7a956242608d2fa4fb13b2
assert_file_hash /fixtures/source/alm_programas_facultades.sql 5994f8097179bdc92a8bcf4a034a5767d97373a55881cb0c3bb1ff0002149197
assert_file_hash /fixtures/source/alumnos.sql 1a6d5dfea45e2a1d7b01e55275879506b61f62639521f7c8620c65d81796ee9f
assert_file_hash /fixtures/source/lugar_localidad.sql ace4e10a1a94fa6a84a81069ad6cce0fbc88e213341dc4cb4d84662635e079a8
assert_file_hash /fixtures/source/notas_planilla.sql 4c6493a84d5a72a8184574755f508d53e29ba1ca0a1a26e9048bbfba659bd036
assert_file_hash /fixtures/source/pln_materias.sql e762d5583a202f09c20cee4530e693033b59605de6c5c784124b3cf3ab08a531
assert_file_hash /fixtures/source/postulantes.sql c8091cda5cf13a37d2b12226b9dd9f83cf37822a8ab8547f8f0d6c525f43f6d1
assert_file_hash /fixtures/source/prs_colegios.sql b7d9b8a0f208bd3cc28180bbe07e9441b1aee6e702170032f06c1f60d16ed1ea
assert_file_hash /fixtures/source/uatf_datos.sql c7e2253debe9fb740dfa26c07086b79c90a2513073fc6f85f49a08a76fcf7b0c
assert_file_hash /fixtures/expected/scd2-cases.yml 0efe7aec63e30d22c137cac05949a142dcde543ebee60f02f98170ebeb910a85
assert_file_hash /fixtures/expected/closure-cases.yml 94d7ebc2ee8feaa1fe9e7df945754b77eaa61a70dbd4106fa10c3f5e5dbf5afe
assert_file_hash /fixtures/expected/quality-cases.yml e7dffe9d18e686b9cdb8cc32de9d7c512fa8662d7871ff8fecfa9a74884de7d6
echo 'Provisioning restricted Load Manager test principal'
target_psql -c "CREATE ROLE loadmanager_test LOGIN PASSWORD 'loadmanager_test' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION"
target_psql -c 'GRANT dw_staging_writer TO loadmanager_test'
sha256sum /fixtures/source/*.sql /fixtures/expected/*.yml
echo 'DW-011 integration test passed'
