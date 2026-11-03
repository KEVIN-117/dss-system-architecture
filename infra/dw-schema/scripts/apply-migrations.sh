#!/bin/sh
set -eu

: "${MIGRATIONS_DIR:=/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Migration directory does not exist: $MIGRATIONS_DIR" >&2
  exit 1
fi

migration_table_exists() {
  psql -v ON_ERROR_STOP=1 -Atqc \
    "SELECT to_regclass('etl_control.schema_migration') IS NOT NULL" | grep -qx 't'
}

normalized_checksum() {
  tr -d '\r' < "$1" | sha256sum | awk '{print $1}'
}

recorded_checksum() {
  psql -v ON_ERROR_STOP=1 -Atqc \
    "SELECT checksum_sha256 FROM etl_control.schema_migration WHERE version = '$1'"
}

recognized_legacy_checksum() {
  version="$1"
  checksum="$2"
  # Migration 0030 was applied in development with the per-run/per-student
  # advisory-lock implementation before the immutable migration was restored
  # to its committed version. Migration 0032 upgrades that function safely.
  # Accept only this exact deployed digest; arbitrary edits still fail closed.
  [ "$version:$checksum" = \
    '0030:d548a3203261269b76fe06a00f306a54d9474c720d5c29a5d74c25e15da62972' ]
}

apply_migration() {
  file="$1"
  filename=$(basename "$file")
  version=${filename%%_*}
  checksum=$(normalized_checksum "$file")

  if migration_table_exists; then
    recorded=$(recorded_checksum "$version")
    if [ -n "$recorded" ]; then
      if [ "$recorded" != "$checksum" ]; then
        if recognized_legacy_checksum "$version" "$recorded"; then
          echo "Skipping recorded migration $filename with recognized legacy checksum"
          return
        else
          echo "Checksum mismatch for migration $filename" >&2
          exit 1
        fi
      fi
      echo "Skipping recorded migration $filename"
      return
    fi
  fi

  echo "Applying migration $filename"
  {
    printf '%s\n' 'BEGIN;'
    tr -d '\r' < "$file"
    if migration_table_exists || [ "$version" = '0002' ]; then
      printf "%s\n" \
        "INSERT INTO etl_control.schema_migration (version, filename, checksum_sha256, applied_by)" \
        "VALUES ('$version', '$filename', '$checksum', current_user)" \
        'ON CONFLICT (version) DO NOTHING;'
    fi
    printf '%s\n' 'COMMIT;'
  } | psql -v ON_ERROR_STOP=1
}

set -- "$MIGRATIONS_DIR"/[0-9][0-9][0-9][0-9]_*.sql
if [ ! -f "$1" ]; then
  echo "No numbered SQL migrations found in $MIGRATIONS_DIR" >&2
  exit 1
fi

for migration in "$@"; do
  apply_migration "$migration"
done
