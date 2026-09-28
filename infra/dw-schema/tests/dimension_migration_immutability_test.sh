#!/bin/sh
set -eu

test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT

cp /migrations/[0-9][0-9][0-9][0-9]_*.sql "$test_dir"/
printf '\n-- DW-006 checksum mutation test\n' >> "$test_dir/0004_create_conformed_dimensions.sql"

if output=$(MIGRATIONS_DIR="$test_dir" sh -c "tr -d '\r' < /scripts/apply-migrations.sh | /bin/sh" 2>&1); then
    echo 'Migration runner accepted an altered DW-006 migration' >&2
    exit 1
fi

if ! printf '%s\n' "$output" | grep -Fq 'Checksum mismatch for migration 0004_create_conformed_dimensions.sql'; then
    echo 'Migration runner failed for an unexpected reason' >&2
    printf '%s\n' "$output" >&2
    exit 1
fi

echo 'Dimension migration checksum test passed'
