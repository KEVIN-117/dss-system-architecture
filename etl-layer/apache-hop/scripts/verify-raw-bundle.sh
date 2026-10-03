#!/bin/sh
set -eu

if [ "$#" -gt 1 ]; then
    echo "usage: verify-raw-bundle.sh [run-id-uuid]" >&2
    exit 2
fi

run_id=${1:-${RUN_ID:-}}
if ! printf '%s' "$run_id" | grep -Eq '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'; then
    echo "RUN_ID must be a UUID" >&2
    exit 2
fi

: "${DB_DW_HOST:?DB_DW_HOST is required}"
: "${DB_DW_PORT:?DB_DW_PORT is required}"
: "${DB_DW_NAME:?DB_DW_NAME is required}"
: "${DB_DW_VERIFY_USER:?DB_DW_VERIFY_USER is required}"
: "${DB_DW_VERIFY_PASS:?DB_DW_VERIFY_PASS is required}"
: "${DW_RAW_ROOT:?DW_RAW_ROOT is required}"

DB_DW_USER=$DB_DW_VERIFY_USER
DB_DW_PASS=$DB_DW_VERIFY_PASS
DB_DW_SSLMODE=${DB_DW_SSLMODE:-disable}
export DB_DW_USER DB_DW_PASS DB_DW_SSLMODE

exec /usr/local/bin/raw-verify -run-id "$run_id"
