#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
compose_file="$repo_root/infra/dw-integration/dw-integration-test.yml"
project_name="dss-dw-local-catalog-sync-$$"

# Keep the source fixture away from the developer's local PostgreSQL ports.
export DW_INTEGRATION_SOURCE_PORT="${DW_INTEGRATION_SOURCE_PORT:-55432}"
export DW_INTEGRATION_TARGET_PORT="${DW_INTEGRATION_TARGET_PORT:-55433}"

compose=(docker compose -p "$project_name" -f "$compose_file")

cleanup() {
  local status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "Academic catalog sync regression failed; fixture logs follow:" >&2
    "${compose[@]}" logs jachasun-fixture auth-catalog-fixture >&2 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  return "$status"
}
trap cleanup EXIT

"${compose[@]}" up -d jachasun-fixture auth-catalog-fixture
"${compose[@]}" --profile academic-catalog-sync run --rm --no-deps hop-catalog-initial-test
"${compose[@]}" --profile academic-catalog-sync run --rm --no-deps hop-catalog-initial-assert
"${compose[@]}" --profile academic-catalog-sync run --rm --no-deps hop-catalog-replay-test
"${compose[@]}" --profile academic-catalog-sync run --rm --no-deps hop-catalog-replay-assert
