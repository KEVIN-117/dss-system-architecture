#!/usr/bin/env bash
# IAM-019: retira los roles antiguos de un realm uatf-dss-realm YA importado y en uso.
#
# Desde IAM-011..014 todos los servicios leen los permisos de dss-permissions; los roles de cliente
# antiguos solo seguían vivos por la convivencia (flags *_LEGACY_ROLES_ENABLED, ya eliminados). Este
# script lleva un entorno existente al mismo estado que infra/keycloak/realm/uatf-dss-realm-realm.json.
# Aplica iam-002 antes. Es idempotente: se puede ejecutar varias veces.
#
# Uso (desde la raíz del repo, con el contenedor de Keycloak en ejecución):
#   docker exec -i uatf-keycloak bash -s < infra/keycloak/migrations/iam-019-retire-legacy-roles.sh
# Simulación (no cambia nada, muestra lo que haría):
#   docker exec -i -e DRY_RUN=1 uatf-keycloak bash -s < infra/keycloak/migrations/iam-019-retire-legacy-roles.sh
#
# Variables (opcionales; por defecto toma las del contenedor):
#   KC_SERVER   URL de Keycloak vista desde donde corre el script (default http://localhost:8080)
#   KC_ADMIN / KC_ADMIN_PASSWORD   admin del realm master (default KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD)
#   KCADM       ruta a kcadm.sh (default /opt/keycloak/bin/kcadm.sh)
#   DRY_RUN     1 para solo mostrar los cambios
#
# Efectos:
#   1. Audiencias explícitas: uatf-auth-service en olap-service (antes llegaba por CONTEXT_READER) y
#      uatf-auth-service, olap-service y dw-control-service en dss-bff.
#   2. Quien tenga un rol antiguo asignado DIRECTAMENTE (usuario o cuenta de servicio) recibe su equivalente:
#        olap-service:OLAP_ADMIN → olap:admin          olap-service:OLAP_USER → olap:user
#        dw-control-service:DW_CLOSURE_READ → dw:closure:read
#        dw-control-service:DW_CLOSURE_MANAGE → dw:closure:manage
#        dw-control-service:DW_ETL_MONITOR_READ → dw:etl-monitor:read
#        uatf-auth-service:CONTEXT_READER → context:read
#        uatf-auth-service:{SUPERADMIN,RECTOR,DECANO,DIRECTOR} → rol del realm del mismo nombre
#   3. Igual con los roles del realm que agrupaban un rol antiguo (roles creados a mano): reciben el permiso.
#      Los cuatro roles del sistema no se tocan: sus compuestos uatf-auth-service:* solo imitaban la
#      jerarquía y sus permisos ya vienen de dss-permissions (iam-002).
#   4. Borra los roles antiguos de los tres clientes. Los clientes siguen existiendo.
set -euo pipefail

REALM=uatf-dss-realm
CATALOG=dss-permissions
KCADM=${KCADM:-/opt/keycloak/bin/kcadm.sh}
KC_SERVER=${KC_SERVER:-http://localhost:8080}
KC_ADMIN=${KC_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:?KC_ADMIN o KC_BOOTSTRAP_ADMIN_USERNAME requerido}}
KC_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:?KC_ADMIN_PASSWORD o KC_BOOTSTRAP_ADMIN_PASSWORD requerido}}
DRY_RUN=${DRY_RUN:-0}

# cliente|rol antiguo|destino. Destino "realm:X" = rol del realm X; si no, permiso de dss-permissions.
LEGACY=(
  "olap-service|OLAP_ADMIN|olap:admin"
  "olap-service|OLAP_USER|olap:user"
  "dw-control-service|DW_CLOSURE_READ|dw:closure:read"
  "dw-control-service|DW_CLOSURE_MANAGE|dw:closure:manage"
  "dw-control-service|DW_ETL_MONITOR_READ|dw:etl-monitor:read"
  "uatf-auth-service|CONTEXT_READER|context:read"
  "uatf-auth-service|SUPERADMIN|realm:SUPERADMIN"
  "uatf-auth-service|RECTOR|realm:RECTOR"
  "uatf-auth-service|DECANO|realm:DECANO"
  "uatf-auth-service|DIRECTOR|realm:DIRECTOR"
)

login() {
  "$KCADM" config credentials --server "$KC_SERVER" --realm master \
    --user "$KC_ADMIN" --password "$KC_ADMIN_PASSWORD" >/dev/null
}
# Cada llamada a kcadm arranca una JVM, así que el script tarda minutos y la sesión de master puede caducar a
# mitad: si pasa, se vuelve a iniciar sesión y se reintenta la llamada (que no llegó a ejecutarse).
kc() {
  local err status
  err=$(mktemp)
  "$KCADM" "$@" 2>"$err" && status=0 || status=$?
  if [ "$status" -eq 0 ]; then
    cat "$err" >&2
    rm -f "$err"
    return 0
  fi
  if grep -q 'Session has expired' "$err"; then
    rm -f "$err"
    login
    "$KCADM" "$@"
    return
  fi
  cat "$err" >&2
  rm -f "$err"
  return "$status"
}
log() { printf '[iam-019] %s\n' "$*"; }
# Cambios: en DRY_RUN solo se muestran.
change() {
  if [ "$DRY_RUN" = "1" ]; then
    log "(simulación) $*"
  else
    kc "$@"
  fi
}
client_uuid() { kc get clients -r "$REALM" -q "clientId=$1" --fields id --format csv --noquotes; }
role_exists() { kc get "clients/$1/roles/$2" -r "$REALM" >/dev/null 2>&1; }

login
[ "$DRY_RUN" = "1" ] && log "DRY_RUN=1: no se cambia nada"

if [ -z "$(client_uuid "$CATALOG")" ]; then
  log "falta el cliente $CATALOG: aplica primero iam-002-permission-catalog.sh"
  exit 1
fi

# 1. Audiencias explícitas
ensure_audience() {
  local client=$1 audience=$2 id
  id=$(client_uuid "$client")
  [ -n "$id" ] || { log "cliente $client no existe; se omite su audiencia"; return; }
  if kc get "clients/$id/protocol-mappers/models" -r "$REALM" --fields name --format csv --noquotes \
      | grep -qxF "audience-$audience"; then
    return
  fi
  change create "clients/$id/protocol-mappers/models" -r "$REALM" \
    -s "name=audience-$audience" -s protocol=openid-connect -s protocolMapper=oidc-audience-mapper \
    -s "config.\"included.client.audience\"=$audience" \
    -s 'config."id.token.claim"=false' -s 'config."access.token.claim"=true' -s 'config."userinfo.token.claim"=false'
  log "audience $audience agregada a $client"
}
ensure_audience olap-service uatf-auth-service
ensure_audience dss-bff uatf-auth-service
ensure_audience dss-bff olap-service
ensure_audience dss-bff dw-control-service

# Concede el destino a un usuario (por id) o a un rol del realm (por nombre).
grant_user() {
  local user_id=$1 target=$2
  if [[ $target == realm:* ]]; then
    change add-roles -r "$REALM" --uid "$user_id" --rolename "${target#realm:}"
    # (un usuario con uatf-auth-service:DECANO directo pasa a tener el rol del realm DECANO)
  else
    change add-roles -r "$REALM" --uid "$user_id" --cclientid "$CATALOG" --rolename "$target"
  fi
}
# Devuelve 1 (sin cambios) cuando no corresponde traducir el compuesto.
grant_role() {
  local role=$1 target=$2
  if [[ $target == realm:* ]]; then
    # Los cuatro roles del sistema agrupaban uatf-auth-service:* solo para imitar la jerarquía antigua
    # (RECTOR ⊃ DECANO ⊃ DIRECTOR); sus permisos ya vienen del catálogo. Traducirlo metería, por ejemplo,
    # el rol del realm DECANO dentro de RECTOR y le aplicaría a un rector las reglas de contexto de decano.
    case $role in SUPERADMIN|RECTOR|DECANO|DIRECTOR) return 1 ;; esac
    change add-roles -r "$REALM" --rname "$role" --rolename "${target#realm:}"
  else
    change add-roles -r "$REALM" --rname "$role" --cclientid "$CATALOG" --rolename "$target"
  fi
}
done_or_planned() { if [ "$DRY_RUN" = "1" ]; then printf 'se %s' "$1"; else printf '%s' "$2"; fi; }

REALM_ROLES=$(kc get roles -r "$REALM" --fields name --format csv --noquotes)

for entry in "${LEGACY[@]}"; do
  IFS='|' read -r client role target <<<"$entry"
  client_id=$(client_uuid "$client")
  if [ -z "$client_id" ] || ! role_exists "$client_id" "$role"; then
    continue
  fi

  # 2. Asignaciones directas (usuarios y cuentas de servicio)
  while IFS=, read -r user_id username; do
    [ -n "$user_id" ] || continue
    grant_user "$user_id" "$target"
    log "$username: $client:$role → ${target}"
  done < <(kc get "clients/$client_id/roles/$role/users" -r "$REALM" --limit 100000 \
             --fields id,username --format csv --noquotes)

  # 3. Roles del realm que lo agrupaban
  while IFS= read -r realm_role; do
    [ -n "$realm_role" ] || continue
    if kc get-roles -r "$REALM" --rname "$realm_role" --cclientid "$client" --fields name --format csv --noquotes \
        2>/dev/null | grep -qxF "$role"; then
      if grant_role "$realm_role" "$target"; then
        log "rol $realm_role: $client:$role → ${target}"
      else
        log "rol $realm_role: $client:$role no se traduce (rol del sistema, ya tiene sus permisos)"
      fi
    fi
  done <<<"$REALM_ROLES"

  # 4. Borrar el rol antiguo (Keycloak lo quita también de compuestos y asignaciones)
  change delete "clients/$client_id/roles/$role" -r "$REALM"
  log "$client:$role $(done_or_planned eliminaría eliminado)"
done

log "listo"
