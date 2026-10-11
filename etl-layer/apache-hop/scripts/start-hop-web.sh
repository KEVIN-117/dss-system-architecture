#!/usr/bin/env bash
set -euo pipefail # fail fast and propagate failures from shell pipelines

hop_home="/usr/local/tomcat/webapps/ROOT"
cd "$hop_home"

: "${HOP_PROJECT_NAME:?HOP_PROJECT_NAME is required}"
: "${HOP_PROJECT_FOLDER:?HOP_PROJECT_FOLDER is required}"
: "${HOP_ENVIRONMENT_NAME:?HOP_ENVIRONMENT_NAME is required}"
: "${HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS:?HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS is required}"

IFS=',' read -r -a selected_config_files <<< "${HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS}"
for config_file in "${selected_config_files[@]}"; do
  config_file="${config_file//[[:space:]]/}"
  if [[ ! -f "${config_file}" ]]; then
    echo "Required Hop environment config is missing: ${config_file}" >&2
    exit 1
  fi
done

if ! ./hop-conf.sh --projects-list | grep -Fq "  ${HOP_PROJECT_NAME} :"; then
  ./hop-conf.sh \
    --project="${HOP_PROJECT_NAME}" \
    --project-create \
    --project-home="${HOP_PROJECT_FOLDER}" \
    --project-config-file="${HOP_PROJECT_CONFIG_FILE_NAME:-project-config.json}" \
    --project-keep-config-file
fi

ensure_environment() {
  local environment_name="$1"
  local config_files="$2"
  local purpose="$3"

  if ! ./hop-conf.sh --environments-list | grep -Fxq "  ${environment_name}"; then
    ./hop-conf.sh \
      --environment="${environment_name}" \
      --environment-create \
      --environment-project="${HOP_PROJECT_NAME}" \
      --environment-purpose="${purpose}" \
      --environment-config-files="${config_files}"
  fi
}

environment_purpose() {
  case "$1" in
    dev) printf '%s' "Development" ;;
    test) printf '%s' "Testing" ;;
    prod) printf '%s' "Production" ;;
    *) printf '%s' "Apache Hop container" ;;
  esac
}

# Register the selected environment with its explicitly configured files.
ensure_environment \
  "${HOP_ENVIRONMENT_NAME}" \
  "${HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS}" \
  "$(environment_purpose "${HOP_ENVIRONMENT_NAME}")"

# Also register local profiles so the Hop Web environment switcher can select
# dev or test without rebuilding the image. Each lifecycle environment gets
# its own config file; do not combine them into one environment.
IFS=',' read -r -a additional_environments <<< "${HOP_ADDITIONAL_ENVIRONMENT_NAMES:-dev,test}"
for environment_name in "${additional_environments[@]}"; do
  environment_name="${environment_name//[[:space:]]/}"
  [[ -z "${environment_name}" || "${environment_name}" == "${HOP_ENVIRONMENT_NAME}" ]] && continue

  config_file="${HOP_PROJECT_FOLDER}/environments/${environment_name}-env.json"
  if [[ -f "${config_file}" ]]; then
    ensure_environment \
      "${environment_name}" \
      "${config_file}" \
      "$(environment_purpose "${environment_name}")"
  else
    echo "Skipping optional Hop environment '${environment_name}': ${config_file} is not present"
  fi
done

# Hop Web otherwise starts with its built-in `default` project and no environment.
./hop-conf.sh \
  --default-project="${HOP_PROJECT_NAME}" \
  --default-environment="${HOP_ENVIRONMENT_NAME}"

exec /tmp/run-web.sh
