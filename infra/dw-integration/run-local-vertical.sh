#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
compose_file="$repo_root/infra/dw-integration/dw-integration-test.yml"
project_name="dss-dw-local-vertical-$$"

# Keep the disposable fixture ports away from the default local Postgres ports.
export DW_INTEGRATION_SOURCE_PORT="${DW_INTEGRATION_SOURCE_PORT:-55432}"
export DW_INTEGRATION_TARGET_PORT="${DW_INTEGRATION_TARGET_PORT:-55433}"

compose=(docker compose -p "$project_name" -f "$compose_file")

cleanup() {
  local status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "Vertical Hop regression failed; PostgreSQL fixture logs follow:" >&2
    "${compose[@]}" logs postgres-dw jachasun-fixture >&2 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  return "$status"
}
trap cleanup EXIT

"${compose[@]}" --profile dw-vertical run --rm hop-vertical-assert
