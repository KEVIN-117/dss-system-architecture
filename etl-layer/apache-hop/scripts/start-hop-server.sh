#!/usr/bin/env bash
# Entry point of the DSS Hop Server image (Load Manager execution engine).
#
# The upstream apache/hop entrypoint (/opt/hop/load-and-execute.sh) already
# registers the project and environment and writes /tmp/hop-server.xml from
# HOP_SERVER_* variables. This wrapper only adds the guards the DSS runtime
# needs before delegating to it:
#   * explicit server credentials (the image defaults to cluster/cluster);
#   * every selected environment file is present;
#   * the container runs as a long-lived server, never as a one-shot hop-run.
set -euo pipefail

fail() {
  echo "start-hop-server: $*" >&2
  exit 1
}

: "${HOP_PROJECT_NAME:?HOP_PROJECT_NAME is required}"
: "${HOP_PROJECT_FOLDER:?HOP_PROJECT_FOLDER is required}"
: "${HOP_ENVIRONMENT_NAME:?HOP_ENVIRONMENT_NAME is required}"
: "${HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS:?HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS is required}"

[[ -d "${HOP_PROJECT_FOLDER}" ]] || fail "project folder ${HOP_PROJECT_FOLDER} does not exist"

IFS=',' read -r -a selected_config_files <<< "${HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS}"
for config_file in "${selected_config_files[@]}"; do
  config_file="${config_file//[[:space:]]/}"
  [[ -f "${config_file}" ]] || fail "required Hop environment config is missing: ${config_file}"
done

# HOP_SERVER_PASS is the variable the upstream entrypoint writes into the
# server config; the base image also defines HOP_SERVER_PASSWORD=cluster,
# which is ignored here on purpose.
[[ -n "${HOP_SERVER_USER:-}" ]] || fail "HOP_SERVER_USER is required"
[[ -n "${HOP_SERVER_PASS:-}" ]] || fail "HOP_SERVER_PASS is required (set it in the root .env or the deployment secrets)"
if [[ "${HOP_SERVER_USER}" == "cluster" || "${HOP_SERVER_PASS}" == "cluster" ]]; then
  fail "refusing to start with the default cluster/cluster credentials"
fi
if (( ${#HOP_SERVER_PASS} < 16 )); then
  fail "HOP_SERVER_PASS must be at least 16 characters"
fi
# The values are written verbatim into an XML file by the upstream script.
if [[ "${HOP_SERVER_USER}${HOP_SERVER_PASS}" =~ [\<\>\&\"\'] ]]; then
  fail "HOP_SERVER_USER and HOP_SERVER_PASS must not contain XML special characters"
fi

export HOP_SERVER_AUTH=true
export HOP_SERVER_PORT="${HOP_SERVER_PORT:-8080}"
# Executions stay visible long enough for dw-control-service to collect their
# final status and log excerpt; afterwards they are cleaned from memory.
export HOP_SERVER_MAX_OBJECT_TIMEOUT="${HOP_SERVER_MAX_OBJECT_TIMEOUT:-1440}"
export HOP_SERVER_MAX_LOG_TIMEOUT="${HOP_SERVER_MAX_LOG_TIMEOUT:-1440}"
export HOP_SERVER_MAX_LOG_LINES="${HOP_SERVER_MAX_LOG_LINES:-20000}"

# Never run a single file: workflows are submitted over the server API.
# Keep them defined but empty; the upstream script runs with `set -u`.
export HOP_FILE_PATH="" HOP_COMMAND="" HOP_RUN_CONFIG=""

exec /opt/hop/load-and-execute.sh
