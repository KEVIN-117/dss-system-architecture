#!/bin/sh
set -eu

: "${SQL_SCRIPT:=/scripts/provision-local-dw-control-runtime.sql}"

if [ ! -f "$SQL_SCRIPT" ]; then
  echo "Provision script does not exist: $SQL_SCRIPT" >&2
  exit 1
fi

if [ -z "${DW_CONTROL_DB_PASSWORD:-}" ]; then
  echo "ERROR: DW_CONTROL_DB_PASSWORD environment variable is required and cannot be empty." >&2
  exit 1
fi

echo "Waiting for PostgreSQL to be ready at ${PGHOST:-postgres-dw}:${PGPORT:-5432}..."
retries=20
until pg_isready -h "${PGHOST:-postgres-dw}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" >/dev/null 2>&1 || [ "$retries" -eq 0 ]; do
  echo "Waiting for database to accept connections ($retries attempts left)..."
  retries=$((retries - 1))
  sleep 2
done

if [ "$retries" -eq 0 ]; then
  echo "ERROR: PostgreSQL is not reachable at ${PGHOST:-postgres-dw}:${PGPORT:-5432} within timeout." >&2
  exit 1
fi

echo "Applying runtime role provisioning for dw-control-service..."
psql -v ON_ERROR_STOP=1 -f "$SQL_SCRIPT"
echo "dw_control_runtime role provisioned successfully."
