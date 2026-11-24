# Especificación Técnica de Integración con Keycloak (Granularidad Microscópica)

## 1. Introducción y Arquitectura General
Esta especificación define el diseño e integración del servidor de identidad **Keycloak (v26.7.4)** como proveedor centralizado de Single Sign-On (SSO) y la aplicación **auth-service** (Resource Server).

El sistema utiliza la arquitectura definida a continuación:
*   **Keycloak**: Fuente de verdad absoluta para la identidad, credenciales, roles y permisos.
*   **auth-service**: Administra identidad y permisos desde el admin-portal mediante la Admin REST API de Keycloak (épica IAM, #290), mantiene una caché local sincronizada de los usuarios y gestiona la segregación académica (`USER_ACADEMIC_CONTEXT`) bajo las directrices del requisito RNF4.1.

```text
                        +---------------------------------------+
                        |               Keycloak                |
                        |    (Realm aislado: uatf-dss-realm)    |
                        +-------------------+-------------------+
                                            |
              +-----------------------------+-----------------------------+
              |                             |                             |
              v                             v                             v
  +-----------------------+    +-------------------------+    +-----------------------+
  |       Clientes        |    |  Catálogo de permisos   |    |      Realm Roles      |
  |  - dss-bff            |    |  dss-permissions        |    |  - SUPERADMIN         |
  |  - uatf-auth-service  |    |  (recurso:acción)       |<---|  - RECTOR             |
  |  - olap-service       |    |  analytics:*, dw:*,     |    |  - DECANO             |
  |  - dw-control-service |    |  olap:*, iam:*, ...     |    |  - DIRECTOR           |
  +-----------+-----------+    +-------------------------+    +-----------------------+
              |                                        (los roles agrupan permisos)
              v
     [Generación de JWT]
              |
              v
  +-----------------------+
  |  BFF y servicios      |
  |  (Resource Servers)   |
  +-----------------------+
```

---

## 2. Infraestructura Docker Compose
Keycloak se ejecuta en el contenedor `uatf-keycloak` dentro de la red compartida `dss-net`, permitiendo la resolución de nombres DNS interna entre contenedores.

### Configuración del Servicio (`docker-compose.yml`)
*   **Imagen**: `quay.io/keycloak/keycloak:26.7.4`
*   **Comando de arranque**: `start-dev --import-realm`
*   **Variables de Entorno**:
    *   `KC_BOOTSTRAP_ADMIN_USERNAME` y `KC_BOOTSTRAP_ADMIN_PASSWORD`: administrador inicial. Se definen en `.env`, nunca en la documentación ni en el repositorio (ver `docs/envs/keycloak.md`).
*   **Puertos**: Mapeo del puerto `8080:8080` para administración local.
*   **Volúmenes**: Mapeo del directorio `./infra/keycloak/realm` a `/opt/keycloak/data/import` en modo de lectura para asegurar la inmutabilidad de la configuración declarativa (IaC).

---

## 3. Modelo de permisos (IAM-002 a IAM-019)
La autorización se basa en **permisos funcionales** y no en roles fijos en el código (decisión D1 de `docs/auth/rbac-iam-admin-proposal.md`):

*   **Permiso:** rol de cliente del cliente bearer-only `dss-permissions`, nombrado `recurso:acción` (`analytics:faculty`, `dw:closure:manage`, `iam:users:write`…). Llega al token en `resource_access.dss-permissions.roles`. Un permiso nuevo se crea desde el admin-portal, sin desplegar código.
*   **Rol del realm:** agrupa permisos como compuestos y decide a qué portal entra el usuario (atributo `portal`). Llega al token en `realm_access.roles`.
*   **Usuario:** recibe roles del realm y, para excepciones, permisos sueltos.

Los servicios autorizan solo con permisos de `dss-permissions` (y los roles del realm para elegir el portal). Los roles de cliente antiguos (`uatf-auth-service:{SUPERADMIN,RECTOR,DECANO,DIRECTOR,CONTEXT_READER}`, `olap-service:OLAP_*`, `dw-control-service:DW_*`) se retiraron en IAM-019; `infra/keycloak/migrations/iam-019-retire-legacy-roles.sh` lleva un realm existente a este estado.

### Segregación de Funciones (Separation of Duties)
En cumplimiento con el Principio de Mínimo Privilegio (PoLP):
* El rol técnico `SUPERADMIN` **no tiene permisos académicos** (`analytics:*`) ni de administración OLAP (`olap:admin`). Un administrador IT no tiene acceso automático a los dashboards académicos.
* La jerarquía aplica estrictamente a las autoridades académicas: cada rol incluye los permisos del anterior.

| Realm Role | Permisos de `dss-permissions` | Alcance Académico y Restricción (RNF4.1) |
| :--- | :--- | :--- |
| 👑 **`SUPERADMIN`** | `iam:*`, `connectors:*`, `pipelines:*`, `prediction:train`, `prediction:forecast:read` | **Técnico Global**. Sin acceso a dashboards académicos. Gestión de usuarios, roles, permisos, aplicaciones y auditoría. |
| 🎓 **`RECTOR`** | DECANO + `analytics:global`, `connectors:read` | **Negocio Global**. Sin contexto académico. |
| 🏛️ **`DECANO`** | DIRECTOR + `analytics:faculty`, `pipelines:read` | **Negocio Facultad**. Uno o más contextos de facultad. |
| 📚 **`DIRECTOR`** | `analytics:read`, `analytics:career`, `prediction:forecast:read` | **Negocio Carrera**. Uno o más contextos de carrera. |

Los permisos `olap:admin`, `olap:user`, `dw:*` y `prediction:publish` se asignan por usuario; `context:read` es solo para la cuenta de servicio de `olap-service`. El detalle y su verificación (`RealmPermissionCatalogTest`) están en `docs/envs/keycloak.md`.

---

## 4. Configuración de Clientes OIDC
Clientes del realm `uatf-dss-realm` (los clientes del sistema son de solo lectura desde el admin-portal):

### A. Cliente Confidencial: `dss-bff`
Utilizado por el BFF para el login de los portales.
*   **Flujo de Autorización**: Authorization Code Flow con PKCE (`standardFlowEnabled: true`), con secreto de cliente.
*   **Audiencias**: mappers explícitos que agregan `uatf-auth-service`, `olap-service` y `dw-control-service` a `aud`.

### B. Cliente Confidencial: `uatf-auth-service`
Utilizado por auth-service para llamar a la Keycloak Admin REST API.
*   **Flujos Habilitados**: solo `serviceAccountsEnabled: true` (Client Credentials Flow).
*   **Roles de Cuenta de Servicio**: los nueve roles mínimos de `realm-management` listados en `docs/envs/keycloak.md` (`view-users`, `manage-users`, `manage-clients`, `manage-realm`…), nunca `realm-admin`.

### C. Cliente Confidencial: `olap-service`
Solo `client_credentials` para leer el alcance académico en auth-service: su cuenta de servicio tiene `context:read` y un audience mapper explícito de `uatf-auth-service`.

### D. Cliente bearer-only: `dw-control-service` y `dss-permissions`
`dw-control-service` solo valida tokens; `dss-permissions` es el contenedor del catálogo de permisos, sin secreto, flujos ni cuenta de servicio.

---

## 5. Sincronización de usuarios con RabbitMQ (Admin Events)
El listener SPI publica snapshots de altas, cambios de perfil y cambios de roles en la cola durable `keycloak.user.events`. `auth-service` consume los mensajes y actualiza su modelo local. Esta integración reemplaza el webhook HTTP.

```text
Consola Admin Keycloak
         |
         v
[Crear/Modificar Usuario]
         |
         v
Generación de AdminEvent (USER - CREATE/UPDATE)
         |
         v
Custom Event Listener SPI (uatf-webhook)
         |
         +--> [AMQP persistent + publisher confirm] --> RabbitMQ: keycloak.user.events
                                                            |
                                                            +--> auth-service consumer
```

### Contrato del mensaje
La publicación usa el exchange default y la routing key/cola `keycloak.user.events`. El cuerpo es JSON UTF-8, el mensaje es persistente y `messageId` replica `eventId`. El publisher espera un confirm del broker; el consumer procesa un evento por vez, reintenta hasta tres veces y envía fallos agotados a `keycloak.user.events.dlq`.

Ejemplo:
```json
{
  "eventId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb50",
  "realmId": "uatf-dss-realm",
  "eventType": "USER_CREATED",
  "timestamp": 1786582715000,
  "user": {
    "keycloakId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "username": "krodriguez",
    "email": "krodriguez@uatf.edu.bo",
    "firstName": "Kevin",
    "lastName": "Rodriguez",
    "isActive": true,
    "roles": [
      {"id": "role-id", "name": "DECANO", "description": "Rol académico", "clientRole": false, "containerId": "realm-id"}
    ]
  }
}
```
La tabla `processed_keycloak_events` hace idempotente el consumo por `eventId` dentro de la misma transacción que persiste el usuario y roles. La garantía es *at-least-once* con deduplicación, no *exactly-once*. La cola y la DLQ son durables, pero el Compose actual usa un broker de un solo nodo y no aporta alta disponibilidad ante pérdida del host.

El provider incluye en cada snapshot los roles realm y client que Keycloak devuelve para el usuario. `auth-service` conserva solo roles realm cuyo nombre corresponde a un `RoleType` local conocido; los client roles y nombres no reconocidos se descartan. Por eso `users`/`roles`/`user_roles` representan el snapshot local de roles de aplicación reconocidos, no un espejo de todos los roles de Keycloak. La autorización de las rutas sigue validando los roles del JWT; estas tablas se usan para el modelo y las reglas de contexto académico, no como autoridad de autorización HTTP.

---

## 6. Proceso de Exportación e Inmutabilidad (IaC)
Para garantizar la inmutabilidad y la capacidad de destruir y recrear la infraestructura de Keycloak en cualquier momento (`docker compose down -v` seguido de `docker compose up -d`), se debe exportar el estado del realm a un archivo JSON que se almacene bajo control de versiones.

### Comando para Exportar el Realm Completo:
Una vez configurado el realm en la interfaz de Keycloak, se ejecuta la exportación dentro del contenedor (o `auth-service/export-realm.ps1`):
```bash
docker exec -it uatf-keycloak /opt/keycloak/bin/kc.sh export \
  --realm uatf-dss-realm \
  --file /opt/keycloak/data/import/uatf-dss-realm-realm.json
```
Esto grabará el archivo en el volumen local `./infra/keycloak/realm/uatf-dss-realm-realm.json`. Antes de versionarlo, enmascarar los secretos de cliente: se inyectan desde variables de entorno al importar.

---

## 7. Criterios de Aceptación y Checklist (Definition of Done)
1. **Infraestructura Reproducible**: Al hacer `docker compose down -v` y `docker compose up -d`, Keycloak debe levantar automáticamente, importar el realm `uatf-dss-realm`, configurar los clientes (`dss-bff`, `uatf-auth-service`, `olap-service`, `dw-control-service`, `dss-permissions`), el catálogo de permisos y los 4 roles globales (`SUPERADMIN`, `RECTOR`, `DECANO`, `DIRECTOR`) sin requerir intervención manual.
2. **Definición de Roles**: Los roles globales existen, tienen nombres en mayúsculas estrictas y descripciones en español que describen con precisión su alcance académico; cada permiso tiene la forma `recurso:acción` y una descripción.
3. **Mensajería Activa**: Crear, actualizar o asignar roles a un usuario produce un mensaje en `keycloak.user.events`; auth-service lo procesa una sola vez y conserva el snapshot de roles reconocidos.
4. **Resiliencia**: Con auth-service detenido, los eventos confirmados permanecen en la cola durable. Después de tres fallos de procesamiento, el evento se conserva en la DLQ para inspección y reproceso operativo.
5. **Seguridad de transporte**: Keycloak y auth-service usan credenciales internas de RabbitMQ; no existe secreto HTTP `X-Webhook-Secret` para esta integración.
