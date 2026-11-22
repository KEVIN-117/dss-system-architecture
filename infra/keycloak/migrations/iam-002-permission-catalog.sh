#!/usr/bin/env bash
# IAM-002: aplica el catálogo de permisos dss-permissions a un realm uatf-dss-realm YA importado.
#
# --import-realm no sobrescribe un realm existente; este script lleva un entorno existente al mismo
# estado que infra/keycloak/realm/uatf-dss-realm-realm.json. Es idempotente: se puede ejecutar varias veces.
#
# Uso (desde la raíz del repo, con el contenedor de Keycloak en ejecución):
#   docker exec -i uatf-keycloak bash -s < infra/keycloak/migrations/iam-002-permission-catalog.sh
#
# Variables (opcionales; por defecto toma las del contenedor):
#   KC_SERVER   URL de Keycloak vista desde donde corre el script (default http://localhost:8080)
#   KC_ADMIN / KC_ADMIN_PASSWORD   admin del realm master (default KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD)
#   KCADM       ruta a kcadm.sh (default /opt/keycloak/bin/kcadm.sh)
#
# Efectos:
#   1. Crea el cliente bearer-only dss-permissions y sus permisos (roles de cliente) si faltan.
#   2. Agrega los permisos a los compuestos de DIRECTOR, DECANO, RECTOR y SUPERADMIN.
#   3. Quita olap-service:OLAP_ADMIN del compuesto SUPERADMIN (D4).
#   4. Da dss-permissions:context:read a service-account-olap-service.
#   5. Agrega a dss-bff el audience mapper explícito de uatf-auth-service.
#   6. Elimina el cliente público uatf-dss-spa (D4).
# No toca los roles antiguos de uatf-auth-service, DW_* ni OLAP_* (se retiran en IAM-019).
# LM-005 (#353): agrega dw:etl:execute y dw:etl-schedule:manage, y da a SUPERADMIN los tres permisos del
# Load Manager (dw:etl-monitor:read, dw:etl:execute, dw:etl-schedule:manage). Volver a ejecutarlo los aplica.
set -euo pipefail

REALM=uatf-dss-realm
CATALOG=dss-permissions
KCADM=${KCADM:-/opt/keycloak/bin/kcadm.sh}
KC_SERVER=${KC_SERVER:-http://localhost:8080}
KC_ADMIN=${KC_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:?KC_ADMIN o KC_BOOTSTRAP_ADMIN_USERNAME requerido}}
KC_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:?KC_ADMIN_PASSWORD o KC_BOOTSTRAP_ADMIN_PASSWORD requerido}}

# nombre|descripción. Debe coincidir con roles.client.dss-permissions del export (RealmPermissionCatalogTest lo verifica).
PERMISSIONS=(
  "analytics:read|Consultar analítica académica dentro del alcance asignado."
  "analytics:career|Analítica con alcance de carrera o programa académico."
  "analytics:faculty|Analítica con alcance de facultad."
  "analytics:global|Analítica con alcance institucional completo."
  "pipelines:read|Consultar el estado de los pipelines de datos."
  "pipelines:execute|Ejecutar pipelines de datos."
  "connectors:read|Consultar conectores de datos."
  "connectors:write|Crear y modificar conectores de datos."
  "prediction:train|Entrenar modelos y gestionar datasets y modelos de predicción."
  "prediction:publish|Iniciar el scoring poblacional y publicar predicciones dentro del alcance académico."
  "olap:admin|Administrar Saiku: datasources, estadísticas y endpoints de administración."
  "olap:user|Usar el workspace OLAP de Saiku."
  "dw:closure:read|Consultar cierres académicos y sus eventos."
  "dw:closure:manage|Crear y gestionar cierres académicos."
  "dw:etl-monitor:read|Consultar ejecuciones ETL del Data Warehouse."
  "dw:etl:execute|Lanzar y detener procesos ETL del Data Warehouse desde el admin-portal."
  "dw:etl-schedule:manage|Crear, modificar, pausar y eliminar programaciones ETL del Data Warehouse."
  "context:read|Servicio a servicio: leer el contexto académico de un usuario en auth-service."
  "iam:users:read|Consultar usuarios, sus roles y permisos desde el admin-portal."
  "iam:users:write|Crear, activar, desactivar usuarios y asignar roles y permisos."
  "iam:roles:read|Consultar roles, permisos y la matriz rol-permiso."
  "iam:roles:write|Crear, modificar y eliminar roles y permisos."
  "iam:clients:read|Consultar las aplicaciones (clientes) registradas."
  "iam:clients:write|Registrar y modificar aplicaciones y rotar sus secretos."
  "iam:audit:read|Consultar la auditoría de operaciones administrativas."
)

# Compuestos por rol del realm (mismo contenido que el export).
DIRECTOR_PERMS="analytics:read analytics:career"
DECANO_PERMS="$DIRECTOR_PERMS analytics:faculty pipelines:read"
RECTOR_PERMS="$DECANO_PERMS analytics:global connectors:read"
SUPERADMIN_PERMS="connectors:read connectors:write pipelines:read pipelines:execute prediction:train iam:users:read iam:users:write iam:roles:read iam:roles:write iam:clients:read iam:clients:write iam:audit:read dw:etl-monitor:read dw:etl:execute dw:etl-schedule:manage"

kc() { "$KCADM" "$@"; }
log() { printf '[iam-002] %s\n' "$*"; }
client_uuid() { kc get clients -r "$REALM" -q "clientId=$1" --fields id --format csv --noquotes; }

kc config credentials --server "$KC_SERVER" --realm master --user "$KC_ADMIN" --password "$KC_ADMIN_PASSWORD" >/dev/null

# 1. Cliente catálogo
CATALOG_ID=$(client_uuid "$CATALOG")
if [ -z "$CATALOG_ID" ]; then
  kc create clients -r "$REALM" \
    -s clientId="$CATALOG" -s name="DSS Permissions" \
    -s 'description=Catálogo de permisos funcionales del DSS (recurso:acción). Cada rol de cliente es un permiso; los roles del realm los agrupan como compuestos.' \
    -s enabled=true -s bearerOnly=true -s publicClient=false \
    -s standardFlowEnabled=false -s implicitFlowEnabled=false -s directAccessGrantsEnabled=false \
    -s serviceAccountsEnabled=false -s fullScopeAllowed=false >/dev/null
  CATALOG_ID=$(client_uuid "$CATALOG")
  log "cliente $CATALOG creado"
else
  log "cliente $CATALOG ya existe"
fi

EXISTING=$(kc get "clients/$CATALOG_ID/roles" -r "$REALM" --fields name --format csv --noquotes)
for entry in "${PERMISSIONS[@]}"; do
  name=${entry%%|*}
  description=${entry#*|}
  if printf '%s\n' "$EXISTING" | grep -qxF "$name"; then
    kc update "clients/$CATALOG_ID/roles/$name" -r "$REALM" -s "description=$description"
  else
    kc create "clients/$CATALOG_ID/roles" -r "$REALM" -s "name=$name" -s "description=$description" >/dev/null
    log "permiso $name creado"
  fi
done

# 2. Compuestos (add-roles es idempotente)
add_permissions() {
  local role=$1; shift
  local args=()
  for permission in "$@"; do args+=(--rolename "$permission"); done
  kc add-roles -r "$REALM" --rname "$role" --cclientid "$CATALOG" "${args[@]}"
  log "$role agrupa: $*"
}
# shellcheck disable=SC2086 # listas separadas por espacios a propósito
add_permissions DIRECTOR $DIRECTOR_PERMS
# shellcheck disable=SC2086
add_permissions DECANO $DECANO_PERMS
# shellcheck disable=SC2086
add_permissions RECTOR $RECTOR_PERMS
# shellcheck disable=SC2086
add_permissions SUPERADMIN $SUPERADMIN_PERMS

# 3. SUPERADMIN sin OLAP_ADMIN
if kc get-roles -r "$REALM" --rname SUPERADMIN --cclientid olap-service --fields name --format csv --noquotes 2>/dev/null \
    | grep -qxF OLAP_ADMIN; then
  kc remove-roles -r "$REALM" --rname SUPERADMIN --cclientid olap-service --rolename OLAP_ADMIN
  log "OLAP_ADMIN quitado de SUPERADMIN"
fi

# 4. olap-service puede leer contexto académico
kc add-roles -r "$REALM" --uusername service-account-olap-service --cclientid "$CATALOG" --rolename context:read
log "service-account-olap-service tiene context:read"

# 5. Audience explícita de uatf-auth-service en dss-bff
BFF_ID=$(client_uuid dss-bff)
if ! kc get "clients/$BFF_ID/protocol-mappers/models" -r "$REALM" --fields name --format csv --noquotes \
    | grep -qxF audience-auth-service; then
  kc create "clients/$BFF_ID/protocol-mappers/models" -r "$REALM" \
    -s name=audience-auth-service -s protocol=openid-connect -s protocolMapper=oidc-audience-mapper \
    -s 'config."included.client.audience"=uatf-auth-service' \
    -s 'config."id.token.claim"=false' -s 'config."access.token.claim"=true' -s 'config."userinfo.token.claim"=false' >/dev/null
  log "audience mapper uatf-auth-service agregado a dss-bff"
fi

# 6. Eliminar uatf-dss-spa
SPA_ID=$(client_uuid uatf-dss-spa)
if [ -n "$SPA_ID" ]; then
  kc delete "clients/$SPA_ID" -r "$REALM"
  log "cliente uatf-dss-spa eliminado"
fi

log "listo"
