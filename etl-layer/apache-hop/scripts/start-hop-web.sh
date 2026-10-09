#!/usr/bin/env bash
set -euo pipefail # fail fast and propagate failures from shell pipelines

hop_home="/usr/local/tomcat/webapps/ROOT"
cd "$hop_home"

: "${HOP_PROJECT_NAME:?HOP_PROJECT_NAME is required}"
: "${HOP_PROJECT_FOLDER:?HOP_PROJECT_FOLDER is required}"
: "${HOP_ENVIRONMENT_NAME:?HOP_ENVIRONMENT_NAME is required}"
: "${HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS:?HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS is required}"

if ! ./hop-conf.sh --projects-list | grep -Fq "  ${HOP_PROJECT_NAME} :"; then
  ./hop-conf.sh \
    --project="${HOP_PROJECT_NAME}" \
    --project-create \
    --project-home="${HOP_PROJECT_FOLDER}" \
    --project-config-file="${HOP_PROJECT_CONFIG_FILE_NAME:-project-config.json}" \
    --project-keep-config-file
fi

if ! ./hop-conf.sh --environments-list | grep -Fxq "  ${HOP_ENVIRONMENT_NAME}"; then
  ./hop-conf.sh \
    --environment="${HOP_ENVIRONMENT_NAME}" \
    --environment-create \
    --environment-project="${HOP_PROJECT_NAME}" \
    --environment-purpose="Apache Hop container" \
    --environment-config-files="${HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS}"
fi

# Hop Web otherwise starts with its built-in `default` project and no environment.
./hop-conf.sh \
  --default-project="${HOP_PROJECT_NAME}" \
  --default-environment="${HOP_ENVIRONMENT_NAME}"

exec /tmp/run-web.sh
