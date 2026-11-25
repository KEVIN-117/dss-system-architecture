#!/bin/sh
set -eu

: "${OLAP_DB_USER:?OLAP_DB_USER must be configured in the root .env}"
: "${OLAP_DB_PASSWORD:?OLAP_DB_PASSWORD must be configured in the root .env}"
: "${OLAP_DB_NAME:?POSTGRES_DW_NAME must be configured in the root .env}"
: "${OLAP_DB_HOST:=postgres-dw}"
: "${OLAP_DB_PORT:=5432}"
: "${SOURCE_DIR:=/source}"
: "${SAIKU_UID:=10001}"
: "${SAIKU_GID:=10001}"

SAIKU_HOME_DIR=${SAIKU_HOME:-/app/saiku-home}
REPOSITORY_DATASOURCES="$SAIKU_HOME_DIR/repository/data/unknown/datasources"
CONF_DIR="$SAIKU_HOME_DIR/conf"

if [ ! -f "$SOURCE_DIR/uatf-rendimiento-academico.xml" ]; then
  echo "FATAL: Catalog schema not found at $SOURCE_DIR/uatf-rendimiento-academico.xml" >&2
  exit 1
fi

if [ ! -f "$SOURCE_DIR/uatf-dw.sds" ]; then
  echo "FATAL: Datasource definition not found at $SOURCE_DIR/uatf-dw.sds" >&2
  exit 1
fi

mkdir -p "$REPOSITORY_DATASOURCES" "$CONF_DIR"

# Schemas referenced as mondrian://datasources/... are repository-internal
# files, resolved relative to repository/data/unknown (not saiku-home itself).
install -m 0644 "$SOURCE_DIR/uatf-rendimiento-academico.xml" \
  "$REPOSITORY_DATASOURCES/uatf-rendimiento-academico.xml"
install -m 0644 "$SOURCE_DIR/uatf-dw.sds" \
  "$REPOSITORY_DATASOURCES/uatf-dw.sds"
rm -f "$SAIKU_HOME_DIR/datasources/uatf-rendimiento-academico.xml"

# The .properties format treats backslashes, separators and leading spaces
# specially. Restrict credentials to a safe generated alphabet so they can be
# written without leaking through command arguments or logs.
case "$OLAP_DB_USER" in
  *[!A-Za-z0-9_.-]*|'') echo "FATAL: OLAP_DB_USER contains unsupported characters." >&2; exit 1 ;;
esac
case "$OLAP_DB_PASSWORD" in
  *[!A-Fa-f0-9]*|'') echo "FATAL: OLAP_DB_PASSWORD must be a non-empty hexadecimal secret." >&2; exit 1 ;;
esac
case "$OLAP_DB_NAME" in
  *[!A-Za-z0-9_]*|'') echo "FATAL: POSTGRES_DW_NAME contains unsupported characters." >&2; exit 1 ;;
esac
case "$OLAP_DB_HOST" in
  *[!A-Za-z0-9_.-]*|'') echo "FATAL: OLAP_DB_HOST contains unsupported characters." >&2; exit 1 ;;
esac
case "$OLAP_DB_PORT" in
  *[!0-9]*|'') echo "FATAL: OLAP_DB_PORT must be an integer." >&2; exit 1 ;;
esac

umask 077
cat > "$CONF_DIR/datasources.properties" <<EOF
datasource.uatf_dw.username=$OLAP_DB_USER
datasource.uatf_dw.password=$OLAP_DB_PASSWORD
datasource.uatf_dw.location=jdbc:mondrian:Jdbc=jdbc:postgresql://${OLAP_DB_HOST}:${OLAP_DB_PORT}/$OLAP_DB_NAME?currentSchema=dw&connectTimeout=5&socketTimeout=60;Catalog=mondrian://datasources/uatf-rendimiento-academico.xml;JdbcDrivers=org.postgresql.Driver;
EOF
chmod 0600 "$CONF_DIR/datasources.properties"

chown -R "${SAIKU_UID}:${SAIKU_GID}" \
  "$REPOSITORY_DATASOURCES" \
  "$CONF_DIR"

echo "Installed academic OLAP catalog and datasource credentials into the Saiku home ($SAIKU_HOME_DIR)."
