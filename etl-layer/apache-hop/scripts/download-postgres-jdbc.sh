#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
jdbc_dir="${script_dir}/../jdbc"
jar_name="postgresql-42.7.11.jar"
jdbc_file="${jdbc_dir}/${jar_name}"
expected_sha256="1981b31d3993c58702783c1cddf10a34e48c1f413d70ff1cb6def0a143484647"
artifact_path="org/postgresql/postgresql/42.7.11/${jar_name}"

# Maven Central rate-limits shared CI egress IPs (HTTP 429). Try it first, then
# Google's Maven Central mirror. The pinned SHA-256 is verified whatever the
# source, so a mirror cannot substitute a different artifact.
mirrors=(
  "https://repo.maven.apache.org/maven2"
  "https://maven-central.storage-download.googleapis.com/maven2"
)

verify() {
  [[ -f "$1" ]] && echo "${expected_sha256}  $1" | sha256sum --check --status
}

mkdir -p "${jdbc_dir}"

# The jdbc folder is bind-mounted read-only into Hop containers that run as a
# non-root user, so the driver must be world-readable (mktemp creates 0600).
publish_readable() {
  chmod 0644 "${jdbc_file}"
}

# Reuse a previously downloaded (or CI-cached) driver when it is intact.
if verify "${jdbc_file}"; then
  publish_readable
  echo "PostgreSQL JDBC driver already present and verified: ${jdbc_file}"
  exit 0
fi

tmp_file="$(mktemp "${jdbc_dir}/.${jar_name}.XXXXXX")"
trap 'rm -f "${tmp_file}"' EXIT

for mirror in "${mirrors[@]}"; do
  url="${mirror}/${artifact_path}"
  echo "Downloading ${url}"
  # --retry treats 429/5xx/timeouts as transient and honours Retry-After.
  if curl --fail --silent --show-error --location \
      --retry 5 --retry-delay 5 --retry-max-time 120 --retry-all-errors \
      --connect-timeout 20 --max-time 120 \
      "${url}" --output "${tmp_file}"; then
    if verify "${tmp_file}"; then
      mv -f "${tmp_file}" "${jdbc_file}"
      publish_readable
      echo "PostgreSQL JDBC driver downloaded and verified: ${jdbc_file}"
      exit 0
    fi
    echo "SHA-256 mismatch for ${url}; trying next source" >&2
  else
    echo "Download failed from ${mirror}; trying next source" >&2
  fi
done

echo "Could not download a verified ${jar_name} from any source" >&2
exit 1
