#!/usr/bin/env bash
# IAM-020 (#404): permisos de acceso a aplicaciones (portal:*) en un realm uatf-dss-realm YA importado y en uso.
#
# Cada aplicación tiene un permiso de acceso en dss-permissions; asignar un rol a una aplicación es que el rol
# contenga ese permiso como compuesto. Un rol abre una sola aplicación. Este script lleva un entorno existente al
# mismo estado que infra/keycloak/realm/uatf-dss-realm-realm.json y traduce lo que hoy decide el portal de los
# roles propios. Es aditivo (ningún servicio cambia de comportamiento solo con aplicarlo) e idempotente.
#
# Uso (desde la raíz del repo, con el contenedor de Keycloak en ejecución):
#   docker exec -i uatf-keycloak bash -s < infra/keycloak/migrations/iam-020-portal-permissions.sh
# Simulación (no cambia nada, muestra lo que haría):
#   docker exec -i -e DRY_RUN=1 uatf-keycloak bash -s < infra/keycloak/migrations/iam-020-portal-permissions.sh
# Con el mapeo del BFF (el mismo valor de KEYCLOAK_PORTAL_ROLES que usa el entorno):
#   docker exec -i -e KEYCLOAK_PORTAL_ROLES='{"VICERRECTOR":"RECTOR"}' uatf-keycloak bash -s < infra/keycloak/migrations/iam-020-portal-permissions.sh
#
# Variables (opcionales; por defecto toma las del contenedor):
#   KC_SERVER   URL de Keycloak vista desde donde corre el script (default http://localhost:8080)
#   KC_ADMIN / KC_ADMIN_PASSWORD   admin del realm master (default KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD)
#   KCADM       ruta a kcadm.sh (default /opt/keycloak/bin/kcadm.sh)
#   KEYCLOAK_PORTAL_ROLES   JSON rol → rol de portal del BFF, por ejemplo {"VICERRECTOR":"RECTOR"}
#   DRY_RUN     1 para solo mostrar los cambios
#
# Efectos:
#   1. Crea los permisos portal:admin, portal:rector, portal:decano y portal:director (o actualiza su descripción).
#   2. Da a cada rol del sistema su aplicación: SUPERADMIN → portal:admin, RECTOR → portal:rector,
#      DECANO → portal:decano, DIRECTOR → portal:director.
#   3. Traduce KEYCLOAK_PORTAL_ROLES: el rol recibe el portal:* del rol de portal al que apuntaba.
#   4. Traduce el atributo "portal" de los roles propios (admin, rector, decano o director) a su portal:*.
#   Un rol que ya tiene un portal:* no recibe otro (una sola aplicación por rol); el conflicto se informa.
#   Al final lista los roles propios que siguen sin aplicación: nadie entra a ninguna app con ellos.
set -euo pipefail

REALM=uatf-dss-realm
CATALOG=dss-permissions
KCADM=${KCADM:-/opt/keycloak/bin/kcadm.sh}
KC_SERVER=${KC_SERVER:-http://localhost:8080}
KC_ADMIN=${KC_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:?KC_ADMIN o KC_BOOTSTRAP_ADMIN_USERNAME requerido}}
KC_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:?KC_ADMIN_PASSWORD o KC_BOOTSTRAP_ADMIN_PASSWORD requerido}}
KEYCLOAK_PORTAL_ROLES=${KEYCLOAK_PORTAL_ROLES:-}
DRY_RUN=${DRY_RUN:-0}

# permiso|descripción|rol del sistema que lo recibe. Debe coincidir con el export (RealmPermissionCatalogTest).
PORTALS=(
  "portal:admin|Entrar al portal de administración (admin-portal).|SUPERADMIN"
  "portal:rector|Entrar al dashboard del rector.|RECTOR"
  "portal:decano|Entrar al dashboard del decano.|DECANO"
  "portal:director|Entrar al dashboard del director de carrera.|DIRECTOR"
)
# Roles que no son de negocio: no abren aplicaciones.
SKIP_ROLES="default-roles-uatf-dss-realm offline_access uma_authorization"

login() {
  "$KCADM" config credentials --server "$KC_SERVER" --realm master \
    --user "$KC_ADMIN" --password "$KC_ADMIN_PASSWORD" >/dev/null
}
# Cada llamada a kcadm arranca una JVM; si la sesión de master caduca a mitad, se vuelve a iniciar sesión y se
# reintenta la llamada (que no llegó a ejecutarse).
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
log() { printf '[iam-020] %s\n' "$*"; }
# Cambios: en DRY_RUN solo se muestran.
change() {
  if [ "$DRY_RUN" = "1" ]; then
    log "(simulación) $*"
  else
    kc "$@" >/dev/null 2>&1 || kc "$@" >/dev/null # el reintento muestra el error si de verdad falla
  fi
}
client_uuid() { kc get clients -r "$REALM" -q "clientId=$1" --fields id --format csv --noquotes; }
# Permisos portal:* que el rol agrupa directamente.
role_portals() {
  kc get-roles -r "$REALM" --rname "$1" --cclientid "$CATALOG" --fields name --format csv --noquotes 2>/dev/null \
    | grep '^portal:' || true
}
# Aplicación de un rol de portal del BFF (SUPERADMIN, RECTOR, DECANO o DIRECTOR); vacío si no es uno de ellos.
portal_of_system_role() {
  local entry
  for entry in "${PORTALS[@]}"; do
    if [ "${entry##*|}" = "$1" ]; then
      printf '%s' "${entry%%|*}"
      return
    fi
  done
}
is_system_role() { [ -n "$(portal_of_system_role "$1")" ]; }
is_skipped() { case " $SKIP_ROLES " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

# Concede la aplicación $2 al rol $1 respetando "una sola aplicación por rol". $3 = origen, para el log.
assign_portal() {
  local role=$1 portal=$2 origin=$3 current
  current=$(role_portals "$role")
  if printf '%s\n' "$current" | grep -qxF "$portal"; then
    log "rol $role ya abre $portal"
    return
  fi
  if [ -n "$current" ]; then
    current=$(printf '%s' "$current" | tr '\n' ' ')
    log "AVISO rol $role ya abre ${current% }; no se agrega $portal ($origin): una sola aplicación por rol"
    return
  fi
  change add-roles -r "$REALM" --rname "$role" --cclientid "$CATALOG" --rolename "$portal"
  log "rol $role abre $portal ($origin)"
}

login
[ "$DRY_RUN" = "1" ] && log "DRY_RUN=1: no se cambia nada"

CATALOG_ID=$(client_uuid "$CATALOG")
if [ -z "$CATALOG_ID" ]; then
  log "falta el cliente $CATALOG: aplica primero iam-002-permission-catalog.sh"
  exit 1
fi

# 1. Permisos de acceso a aplicaciones
EXISTING=$(kc get "clients/$CATALOG_ID/roles" -r "$REALM" --fields name --format csv --noquotes)
CREATED=""
for entry in "${PORTALS[@]}"; do
  IFS='|' read -r name description _ <<<"$entry"
  if printf '%s\n' "$EXISTING" | grep -qxF "$name"; then
    change update "clients/$CATALOG_ID/roles/$name" -r "$REALM" -s "description=$description"
  else
    change create "clients/$CATALOG_ID/roles" -r "$REALM" -s "name=$name" -s "description=$description"
    CREATED="$CREATED $name"
    [ "$DRY_RUN" = "1" ] || log "permiso $name creado"
  fi
done

# En DRY_RUN los permisos nuevos no existen todavía: get-roles no los ve, así que los pasos siguientes se simulan
# sin consultar el estado de cada rol.
planned() { [ "$DRY_RUN" = "1" ] && case " $CREATED " in *" $1 "*) return 0 ;; esac; return 1; }

# 2. Roles del sistema
for entry in "${PORTALS[@]}"; do
  IFS='|' read -r name _ system_role <<<"$entry"
  if planned "$name"; then
    log "(simulación) rol $system_role abriría $name"
  else
    assign_portal "$system_role" "$name" "rol del sistema"
  fi
done

REALM_ROLES=$(kc get roles -r "$REALM" --fields name --format csv --noquotes)
role_exists() { printf '%s\n' "$REALM_ROLES" | grep -qxF "$1"; }

# 3. KEYCLOAK_PORTAL_ROLES: {"ROL":"RECTOR", ...} (formato validado por el BFF; sin espacios en los nombres)
if [ -n "$KEYCLOAK_PORTAL_ROLES" ]; then
  pairs=$(printf '%s' "$KEYCLOAK_PORTAL_ROLES" | tr -d '{}" \n\r' | tr ',' '\n')
  while IFS=: read -r role target; do
    [ -n "$role" ] || continue
    portal=$(portal_of_system_role "$target")
    if [ -z "$portal" ]; then
      log "AVISO KEYCLOAK_PORTAL_ROLES: $role apunta a '$target', que no es un rol de portal; se omite"
    elif ! role_exists "$role"; then
      log "AVISO KEYCLOAK_PORTAL_ROLES: el rol $role no existe en el realm; se omite"
    elif is_system_role "$role"; then
      log "KEYCLOAK_PORTAL_ROLES: $role es un rol del sistema; ya tiene su aplicación"
    elif planned "$portal"; then
      log "(simulación) rol $role abriría $portal (KEYCLOAK_PORTAL_ROLES)"
    else
      assign_portal "$role" "$portal" "KEYCLOAK_PORTAL_ROLES"
    fi
  done <<<"$pairs"
fi

# 4. Atributo "portal" de los roles propios, y 5. roles que siguen sin aplicación
WITHOUT_APP=""
while IFS= read -r role; do
  [ -n "$role" ] || continue
  if is_system_role "$role" || is_skipped "$role"; then
    continue
  fi
  # Sin --fields: "--fields attributes" vacía el objeto anidado.
  attribute=$(kc get "roles/$role" -r "$REALM" 2>/dev/null \
    | tr -d '\n' | sed -n 's/.*"portal" *: *\[ *"\([^"]*\)".*/\1/p')
  if [ -n "$attribute" ]; then
    case $attribute in
      admin|rector|decano|director)
        if planned "portal:$attribute"; then
          log "(simulación) rol $role abriría portal:$attribute (atributo portal)"
          continue
        fi
        assign_portal "$role" "portal:$attribute" "atributo portal"
        ;;
      *)
        log "AVISO rol $role tiene portal='$attribute', que no es una aplicación (admin, rector, decano, director); se omite"
        ;;
    esac
  fi
  if [ "$DRY_RUN" != "1" ] && [ -z "$(role_portals "$role")" ]; then
    WITHOUT_APP="$WITHOUT_APP $role"
  fi
done <<<"$REALM_ROLES"

if [ -n "$WITHOUT_APP" ]; then
  log "AVISO roles sin aplicación (nadie entra a una app con ellos; asígnala en el admin-portal):$WITHOUT_APP"
fi
log "listo"
