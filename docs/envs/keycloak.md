# Keycloak

## Configuración del contenedor

El Compose raíz utiliza `KC_BOOTSTRAP_ADMIN_USERNAME` y `KC_BOOTSTRAP_ADMIN_PASSWORD` para el administrador inicial. La conexión JDBC se fija en el comando: PostgreSQL, `auth-service-db:5432/dss_identity`, esquema `keycloak`, con `KC_DB_USERNAME` y `KC_DB_PASSWORD`. El servicio escucha dentro del contenedor en 8080 y publica loopback host 8080; health/metrics se publica en loopback 9000.

`KEYCLOAK_BFF_CLIENT_SECRET` es secreto del cliente confidencial BFF. Se exige al interpolar Compose, se utiliza también al importar la configuración del realm y debe coincidir con el secreto provisionado en Keycloak. No es el secreto de sesión del BFF.

`KEYCLOAK_OLAP_CLIENT_SECRET` es el secreto del cliente confidencial `olap-service`. Ese cliente ya no es público ni admite login interactivo (standard flow desactivado): solo emite tokens `client_credentials` para su cuenta de servicio `service-account-olap-service`, que tiene el permiso `dss-permissions: context:read` para leer el alcance académico. El cliente agrega `uatf-auth-service` a `aud` con un audience mapper explícito. Se exige al interpolar Compose y se usa al importar el realm.

`KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET` es el secreto del cliente confidencial `uatf-auth-service`. Solo admite `client_credentials` (sin standard flow, password ni implicit). Su cuenta de servicio `service-account-uatf-auth-service` tiene los roles mínimos de `realm-management` para que auth-service gestione identidad desde el admin-portal mediante la Admin REST API (épica IAM, #290):

| Rol `realm-management` | Para qué |
|---|---|
| `view-users`, `query-users`, `manage-users` | Listar, crear, actualizar y desactivar usuarios; asignar roles; enviar correos de acción requerida |
| `view-clients`, `query-clients`, `manage-clients` | Listar y registrar clientes; crear roles de cliente (permisos de `dss-permissions`); rotar secretos |
| `view-realm`, `manage-realm` | Listar y crear roles del realm y editar sus compuestos. Keycloak exige `manage-realm` para escribir roles del realm |
| `query-groups` | Resolver grupos en búsquedas de usuarios |

No se otorgan `realm-admin`, `manage-authorization`, `manage-identity-providers` ni `manage-events`. `RealmAuthServiceAdminAccessTest` (módulo `keycloak-webhook`) verifica este conjunto exacto. El secreto se exige al interpolar Compose y se usa al importar el realm.

**Realms ya importados:** `--import-realm` no sobrescribe un realm existente. En un entorno que ya tiene `uatf-dss-realm`, aplicar a mano (consola o `kcadm`): volver confidencial `olap-service` con service account y el secreto anterior, desactivar standard flow y aplicar los scripts de `infra/keycloak/migrations/` en orden (`iam-002` crea el catálogo y da `context:read` a `service-account-olap-service`; `iam-019` retira los roles antiguos).

Para `uatf-auth-service` (IAM-001), con `kcadm.sh` dentro del contenedor:

```sh
kcadm.sh config credentials --server http://localhost:8080 --realm master --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"
CID=$(kcadm.sh get clients -r uatf-dss-realm -q clientId=uatf-auth-service --fields id --format csv --noquotes)
# Fijar el secreto al valor de KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET (sustituye al '**********' importado antes)
kcadm.sh update clients/$CID -r uatf-dss-realm -s "secret=$KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET"
kcadm.sh add-roles -r uatf-dss-realm --uusername service-account-uatf-auth-service --cclientid realm-management   --rolename manage-clients --rolename manage-realm --rolename manage-users   --rolename query-clients --rolename query-groups --rolename query-users   --rolename view-clients --rolename view-realm --rolename view-users
```

Comprobación: un `client_credentials` con `uatf-auth-service` debe devolver un token cuyo `resource_access.realm-management.roles` contenga exactamente esos nueve roles.

## Catálogo de permisos (`dss-permissions`)

Desde IAM-002 (decisiones D1 y D4 de `docs/auth/rbac-iam-admin-proposal.md`), el realm tiene un modelo de permisos funcionales:

- **Permiso:** un rol del cliente bearer-only `dss-permissions`. Se nombra `recurso:acción` (por ejemplo `analytics:faculty`, `dw:closure:manage`, `iam:users:write`) y lleva una descripción. El cliente no tiene secreto, flujos ni cuenta de servicio, y solo sirve de contenedor.
- **Rol del realm:** agrupa permisos como compuestos. Llegan al token en `resource_access.dss-permissions.roles` (y `dss-permissions` aparece en `aud`).

| Rol | Permisos |
|---|---|
| DIRECTOR | `analytics:read`, `analytics:career`, `prediction:forecast:read` |
| DECANO | DIRECTOR + `analytics:faculty`, `pipelines:read` |
| RECTOR | DECANO + `analytics:global`, `connectors:read` |
| SUPERADMIN | `connectors:read`, `connectors:write`, `pipelines:read`, `pipelines:execute`, `prediction:train`, `prediction:forecast:read`, `iam:users:read`, `iam:users:write`, `iam:roles:read`, `iam:roles:write`, `iam:clients:read`, `iam:clients:write`, `iam:audit:read`, `dw:etl-monitor:read`, `dw:etl:execute`, `dw:etl-schedule:manage` (Load Manager, LM-005) |

- **Permisos que se asignan por usuario:** `olap:admin`, `olap:user`, `dw:closure:read`, `dw:closure:manage` y `prediction:publish` (IAM-013: iniciar el scoring poblacional). Ningún rol los incluye.
- **Load Manager (LM-005):** `dw:etl-monitor:read`, `dw:etl:execute`, `dw:etl-schedule:manage` vienen en SUPERADMIN. A otros usuarios se asignan por separado: lectura y monitoreo, lanzar y detener cargas, y administrar programaciones. `iam-002-permission-catalog.sh` aplica estos cambios a un realm ya importado; se vuelve a ejecutar sin efectos duplicados.
- **Permiso de servicio:** `context:read`, que tiene `service-account-olap-service`.

**Roles antiguos retirados (IAM-019):** los roles de cliente `uatf-auth-service:{SUPERADMIN,RECTOR,DECANO,DIRECTOR,CONTEXT_READER}`, `olap-service:{OLAP_ADMIN,OLAP_USER}` y `dw-control-service:{DW_CLOSURE_READ,DW_CLOSURE_MANAGE,DW_ETL_MONITOR_READ}` ya no existen. Todos los servicios leen solo `dss-permissions` y los roles del realm. Los clientes siguen existiendo. Como esos roles añadían el `aud` de su cliente («audience resolve»), las audiencias ahora son explícitas: `dss-bff` incluye `uatf-auth-service`, `olap-service` y `dw-control-service`, y `olap-service` incluye `uatf-auth-service`.

En un realm ya importado, ejecutar después de `iam-002`:

```sh
docker exec -i -e DRY_RUN=1 uatf-keycloak bash -s < infra/keycloak/migrations/iam-019-retire-legacy-roles.sh   # revisar
docker exec -i uatf-keycloak bash -s < infra/keycloak/migrations/iam-019-retire-legacy-roles.sh
```

El script es idempotente: agrega las audiencias que falten, da a cada usuario, cuenta de servicio o rol del realm que tenía un rol antiguo su equivalente (`OLAP_ADMIN` → `olap:admin`, `DW_CLOSURE_READ` → `dw:closure:read`, `CONTEXT_READER` → `context:read`, `uatf-auth-service:RECTOR` → rol del realm `RECTOR`…) y después borra los roles antiguos. Los tokens ya emitidos con esos roles dejan de dar acceso en cuanto se despliegan los servicios; los usuarios recuperan el acceso al renovar la sesión.

**Cambios de D4:**
- SUPERADMIN ya no incluye `olap-service:OLAP_ADMIN`. Desde IAM-012 la administración de Saiku se concede con el permiso `olap:admin`.
- Se eliminó el cliente público `uatf-dss-spa`, que no se usaba.
- `dss-bff` agrega `uatf-auth-service` a `aud` con un audience mapper explícito.

`RealmPermissionCatalogTest` (módulo `keycloak-webhook`) verifica este modelo y que el script de migración declare el mismo catálogo que el export.

**Realms ya importados:** aplicar el script idempotente:

```sh
docker exec -i uatf-keycloak bash -s < infra/keycloak/migrations/iam-002-permission-catalog.sh
```

Usa las credenciales `KC_BOOTSTRAP_ADMIN_*` del contenedor. Para otro servidor, definir `KC_SERVER`, `KC_ADMIN` y `KC_ADMIN_PASSWORD`. Eliminar `uatf-dss-spa` no se puede deshacer. Los usuarios necesitan volver a iniciar sesión para recibir tokens con los permisos.

## Provider de eventos

El provider usa `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` y `RABBITMQ_VHOST`. Compose inyecta las credenciales desde `RABBITMQ_DEFAULT_USER/PASS`; dentro de Docker usa `rabbitmq:5672` y vhost `/`. La publicación no usa una URL HTTP al auth-service: RabbitMQ desacopla temporalmente la disponibilidad de ambos servicios.

## Por ambiente

- **Dev:** `start-dev`, realm importado, puerto host limitado a loopback. Issuer accesible para auth-service por `http://keycloak:8080/realms/<realm>`.
- **Prueba/integración:** realm y provider de prueba con broker de fixture; URLs accesibles en la red de prueba.
- **Producción:** no usar `start-dev`; configurar proxy/hostname/TLS, bootstrap y DB con secretos administrados, broker privado y credenciales restringidas. El Compose actual está orientado a desarrollo y no es una plantilla de despliegue productivo completa.

Las variables `KC_DB`, `KC_DB_URL`, `KC_DB_SCHEMA`, y pool aparecen en `.env.example`, pero el Compose actual fija motor, URL y schema mediante argumentos; no asumir que cambiarlas en `.env` cambia el comando actual.
