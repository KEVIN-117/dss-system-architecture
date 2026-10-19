#!/bin/sh
set -eu

: "${OLAP_DB_USER:?OLAP_DB_USER must be configured in the root .env}"
: "${OLAP_DB_PASSWORD:?OLAP_DB_PASSWORD must be configured in the root .env}"
: "${OLAP_DB_NAME:?POSTGRES_DW_NAME must be configured in the root .env}"

SAIKU_HOME_DIR=${SAIKU_HOME:-/app/saiku-home}
REPOSITORY_DATASOURCES="$SAIKU_HOME_DIR/repository/data/unknown/datasources"
CONF_DIR="$SAIKU_HOME_DIR/conf"

mkdir -p "$REPOSITORY_DATASOURCES" "$CONF_DIR"
# Schemas referenced as mondrian://datasources/... are repository-internal
# files, resolved relative to repository/data/unknown (not saiku-home itself).
install -m 0644 /source/uatf-rendimiento-academico.xml \
  "$REPOSITORY_DATASOURCES/uatf-rendimiento-academico.xml"
install -m 0644 /source/uatf-dw.sds \
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

umask 077
cat > "$CONF_DIR/datasources.properties" <<EOF
datasource.uatf_dw.username=$OLAP_DB_USER
datasource.uatf_dw.password=$OLAP_DB_PASSWORD
datasource.uatf_dw.location=jdbc:mondrian:Jdbc=jdbc:postgresql://postgres-dw:5432/$OLAP_DB_NAME?currentSchema=dw&connectTimeout=5&socketTimeout=60;Catalog=mondrian://datasources/uatf-rendimiento-academico.xml;JdbcDrivers=org.postgresql.Driver;
EOF
chmod 0600 "$CONF_DIR/datasources.properties"

chown 10001:10001 \
  "$REPOSITORY_DATASOURCES" \
  "$REPOSITORY_DATASOURCES/uatf-rendimiento-academico.xml" \
  "$REPOSITORY_DATASOURCES/uatf-dw.sds" \
  "$CONF_DIR" \
  "$CONF_DIR/datasources.properties"

echo "Installed academic OLAP catalog and datasource credentials into the Saiku home."
