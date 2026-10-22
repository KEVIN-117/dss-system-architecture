#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
jdbc_dir="${script_dir}/../jdbc"
jdbc_file="${jdbc_dir}/postgresql-42.7.11.jar"
expected_sha256="1981b31d3993c58702783c1cddf10a34e48c1f413d70ff1cb6def0a143484647"
url="https://repo.maven.apache.org/maven2/org/postgresql/postgresql/42.7.11/postgresql-42.7.11.jar"

mkdir -p "${jdbc_dir}"
curl --fail --silent --show-error --location "${url}" --output "${jdbc_file}"
echo "${expected_sha256}  ${jdbc_file}" | sha256sum --check --status
