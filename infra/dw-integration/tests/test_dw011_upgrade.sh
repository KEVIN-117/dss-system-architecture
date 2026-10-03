#!/bin/sh
set -eu

# Isolated synthetic database in the disposable PostgreSQL fixture cluster.
upgrade_db="dw011_upgrade_$$"
subset=$(mktemp -d)
createdb "$upgrade_db"
for migration in /migrations/000[1-6]_*.sql; do
    ln -s "$migration" "$subset/$(basename "$migration")"
done

apply_runner() {
    tr -d '\r' < /scripts/apply-migrations.sh | PGDATABASE="$upgrade_db" MIGRATIONS_DIR="$1" /bin/sh
}

apply_runner "$subset"
PGDATABASE="$upgrade_db" psql -X -v ON_ERROR_STOP=1 <<'SQL'
SELECT etl_control.create_etl_execution(
    '99999999-9999-9999-9999-999999999999'::uuid,
    'HISTORICA'::varchar(24), 'integration-test:upgrade'::varchar(255)
);
INSERT INTO staging.raw_uatf_datos (run_id, row_ordinal, id_ra, estado_civil, _modificado, row_sha256)
VALUES ('99999999-9999-9999-9999-999999999999', 1, NULL, NULL, NULL, repeat('a', 64));
SQL

apply_runner /migrations
apply_runner /migrations

legacy_rows=$(PGDATABASE="$upgrade_db" psql -X -v ON_ERROR_STOP=1 -Atqc \
    "SELECT count(*) FROM staging.raw_uatf_datos WHERE run_id = '99999999-9999-9999-9999-999999999999' AND id_ra IS NULL AND estado_civil IS NULL AND _modificado IS NULL")
test "$legacy_rows" = 1
versions=$(PGDATABASE="$upgrade_db" psql -X -v ON_ERROR_STOP=1 -Atqc \
	"SELECT count(*) FROM etl_control.schema_migration WHERE version IN ('0001','0002','0003','0004','0005','0006','0007','0008')")
test "$versions" = 8
if PGDATABASE="$upgrade_db" psql -X -v ON_ERROR_STOP=1 -qc \
    "INSERT INTO staging.raw_uatf_datos (run_id, row_ordinal, id_ra, estado_civil, _modificado, row_sha256) VALUES ('99999999-9999-9999-9999-999999999999', 2, NULL, NULL, NULL, repeat('a', 64))" >/dev/null 2>&1; then
    echo '0007 accepted an invalid new RAW row' >&2
    exit 1
fi
echo 'DW-011 upgrade preserved historical RAW and rejected invalid new rows'
