#!/bin/sh
set -eu

version='0031'
legacy_checksum='9f464213c2396c80f4d77be14c1dcae22e90ca6d0636f85766e5b097936aae1d'
current_checksum=$(psql -v ON_ERROR_STOP=1 -Atqc \
    "SELECT checksum_sha256 FROM etl_control.schema_migration WHERE version = '$version'")

if [ -z "$current_checksum" ]; then
    echo "Migration $version is not recorded; cannot test its legacy checksum" >&2
    exit 1
fi

restore_checksum() {
    psql -v ON_ERROR_STOP=1 -q -c \
        "UPDATE etl_control.schema_migration SET checksum_sha256 = '$current_checksum' WHERE version = '$version'"
}
trap restore_checksum EXIT HUP INT TERM

psql -v ON_ERROR_STOP=1 -q -c \
    "UPDATE etl_control.schema_migration SET checksum_sha256 = '$legacy_checksum' WHERE version = '$version'"

if ! output=$(tr -d '\r' < /scripts/apply-migrations.sh | /bin/sh 2>&1); then
    echo 'Migration runner rejected the recorded 0031 legacy checksum' >&2
    printf '%s\n' "$output" >&2
    exit 1
fi

if ! printf '%s\n' "$output" | grep -Fq \
    'Skipping recorded migration 0031_prediction_inference_read_access.sql with recognized legacy checksum'; then
    echo 'Migration runner did not report the expected 0031 legacy checksum' >&2
    printf '%s\n' "$output" >&2
    exit 1
fi

restore_checksum
trap - EXIT HUP INT TERM
echo 'Legacy migration checksum compatibility test passed'
