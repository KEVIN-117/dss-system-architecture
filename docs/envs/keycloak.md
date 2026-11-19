# Keycloak

## Configuración del contenedor

El Compose raíz utiliza `KC_BOOTSTRAP_ADMIN_USERNAME` y `KC_BOOTSTRAP_ADMIN_PASSWORD` para el administrador inicial. La conexión JDBC se fija en el comando: PostgreSQL, `auth-service-db:5432/dss_identity`, esquema `keycloak`, con `KC_DB_USERNAME` y `KC_DB_PASSWORD`. El servicio escucha dentro del contenedor en 8080 y publica loopback host 8080; health/metrics se publica en loopback 9000.

`KEYCLOAK_BFF_CLIENT_SECRET` es secreto del cliente confidencial BFF. Se exige al interpolar Compose, se utiliza también al importar la configuración del realm y debe coincidir con el secreto provisionado en Keycloak. No es el secreto de sesión del BFF.

`KEYCLOAK_OLAP_CLIENT_SECRET` es el secreto del cliente confidencial `olap-service`. Ese cliente ya no es público ni admite login interactivo (standard flow desactivado): solo emite tokens `client_credentials` para su cuenta de servicio `service-account-olap-service`, que tiene el rol `uatf-auth-service: CONTEXT_READER` para leer el alcance académico. Se exige al interpolar Compose y se usa al importar el realm.

`KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET` es el secreto del cliente confidencial `uatf-auth-service`. Solo admite `client_credentials` (sin standard flow, password ni implicit). Su cuenta de servicio `service-account-uatf-auth-service` tiene los roles mínimos de `realm-management` para que auth-service gestione identidad desde el admin-portal mediante la Admin REST API (épica IAM, #290):

| Rol `realm-management` | Para qué |
|---|---|
| `view-users`, `query-users`, `manage-users` | Listar, crear, actualizar y desactivar usuarios; asignar roles; enviar correos de acción requerida |
| `view-clients`, `query-clients`, `manage-clients` | Listar y registrar clientes; crear roles de cliente (permisos de `dss-permissions`); rotar secretos |
| `view-realm`, `manage-realm` | Listar y crear roles del realm y editar sus compuestos. Keycloak exige `manage-realm` para escribir roles del realm |
| `query-groups` | Resolver grupos en búsquedas de usuarios |

No se otorgan `realm-admin`, `manage-authorization`, `manage-identity-providers` ni `manage-events`. `RealmAuthServiceAdminAccessTest` (módulo `keycloak-webhook`) verifica este conjunto exacto. El secreto se exige al interpolar Compose y se usa al importar el realm.

**Realms ya importados:** `--import-realm` no sobrescribe un realm existente. En un entorno que ya tiene `uatf-dss-realm`, aplicar a mano (consola o `kcadm`): volver confidencial `olap-service` con service account y el secreto anterior, desactivar standard flow, crear el rol de cliente `CONTEXT_READER` en `uatf-auth-service` y asignarlo a `service-account-olap-service`.

Para `uatf-auth-service` (IAM-001), con `kcadm.sh` dentro del contenedor:

```sh
kcadm.sh config credentials --server http://localhost:8080 --realm master --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"
CID=$(kcadm.sh get clients -r uatf-dss-realm -q clientId=uatf-auth-service --fields id --format csv --noquotes)
# Fijar el secreto al valor de KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET (sustituye al '**********' importado antes)
kcadm.sh update clients/$CID -r uatf-dss-realm -s "secret=$KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET"
kcadm.sh add-roles -r uatf-dss-realm --uusername service-account-uatf-auth-service --cclientid realm-management   --rolename manage-clients --rolename manage-realm --rolename manage-users   --rolename query-clients --rolename query-groups --rolename query-users   --rolename view-clients --rolename view-realm --rolename view-users
```

Comprobación: un `client_credentials` con `uatf-auth-service` debe devolver un token cuyo `resource_access.realm-management.roles` contenga exactamente esos nueve roles.

## Provider de eventos

El provider usa `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` y `RABBITMQ_VHOST`. Compose inyecta las credenciales desde `RABBITMQ_DEFAULT_USER/PASS`; dentro de Docker usa `rabbitmq:5672` y vhost `/`. La publicación no usa una URL HTTP al auth-service: RabbitMQ desacopla temporalmente la disponibilidad de ambos servicios.

## Por ambiente

- **Dev:** `start-dev`, realm importado, puerto host limitado a loopback. Issuer accesible para auth-service por `http://keycloak:8080/realms/<realm>`.
- **Prueba/integración:** realm y provider de prueba con broker de fixture; URLs accesibles en la red de prueba.
- **Producción:** no usar `start-dev`; configurar proxy/hostname/TLS, bootstrap y DB con secretos administrados, broker privado y credenciales restringidas. El Compose actual está orientado a desarrollo y no es una plantilla de despliegue productivo completa.

Las variables `KC_DB`, `KC_DB_URL`, `KC_DB_SCHEMA`, y pool aparecen en `.env.example`, pero el Compose actual fija motor, URL y schema mediante argumentos; no asumir que cambiarlas en `.env` cambia el comando actual.
