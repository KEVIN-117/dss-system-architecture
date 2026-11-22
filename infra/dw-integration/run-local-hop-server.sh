#!/usr/bin/env bash
# Local Hop Server regression (LM-001): builds the packaged Hop Server image,
# submits wf_sync_academic_catalog over its HTTP API and asserts the result.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
compose_file="$repo_root/infra/dw-integration/dw-integration-test.yml"
project_name="dss-dw-local-hop-server-$$"

# Keep the source fixture away from the developer's local PostgreSQL ports.
export DW_INTEGRATION_SOURCE_PORT="${DW_INTEGRATION_SOURCE_PORT:-55432}"
export DW_INTEGRATION_TARGET_PORT="${DW_INTEGRATION_TARGET_PORT:-55433}"

compose=(docker compose -p "$project_name" -f "$compose_file" --profile hop-server)

cleanup() {
  local status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "Hop Server regression failed; logs follow:" >&2
    "${compose[@]}" logs --no-color hop-server auth-catalog-fixture >&2 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  return "$status"
}
trap cleanup EXIT

"${compose[@]}" build hop-server
"${compose[@]}" up -d --wait jachasun-fixture auth-catalog-fixture hop-server
"${compose[@]}" run --rm --no-deps hop-server-catalog-test
"${compose[@]}" run --rm --no-deps hop-server-catalog-assert
