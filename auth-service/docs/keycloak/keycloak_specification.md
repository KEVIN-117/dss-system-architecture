# Especificación Técnica de Integración con Keycloak (Granularidad Microscópica)

## 1. Introducción y Arquitectura General
Esta especificación define el diseño e integración del servidor de identidad **Keycloak (v26.7.1)** como proveedor centralizado de Single Sign-On (SSO) y la aplicación **auth-service** (Resource Server).

El sistema utiliza la arquitectura definida a continuación:
*   **Keycloak**: Fuente de verdad absoluta para la identidad, credenciales y asignación de roles.
*   **auth-service**: Mantiene una caché local sincronizada de los datos de usuario y gestiona la segregación académica (`USER_ACADEMIC_CONTEXT`) bajo las directrices del requisito RNF4.1.

```text
                        +---------------------------------------+
                        |               Keycloak                |
                        |      (Realm Aislado: uatf-realm)       |
                        +-------------------+-------------------+
                                            |
                         +------------------+------------------+
                         |                                     |
                         v                                     v
             +-----------------------+              +-----------------------+
             |        Clientes       |              |      Realm Roles      |
             |  - uatf-dss-spa       |              |  - SUPERADMIN         |
             |  - uatf-auth-service  |              |  - RECTOR             |
             +-----------+-----------+              |  - DECANO             |
                         |                          |  - DIRECTOR           |
                         v                          +-----------------------+
                [Generación de JWT]
                         |
                         v
             +-----------------------+
             |     auth-service      |
             |    (Resource Server)  |
             +-----------------------+
```

---

## 2. Infraestructura Docker Compose
Keycloak se ejecuta en el contenedor `uatf-keycloak` dentro de la red compartida `dss-net`, permitiendo la resolución de nombres DNS interna entre contenedores.

### Configuración del Servicio (`docker-compose.yml`)
*   **Imagen**: `quay.io/keycloak/keycloak:26.7.1`
*   **Comando de arranque**: `start-dev --import-realm`
*   **Variables de Entorno**:
    *   `KC_BOOTSTRAP_ADMIN_USERNAME`: `kerbero`
    *   `KC_BOOTSTRAP_ADMIN_PASSWORD`: `jFeCD7`
*   **Puertos**: Mapeo del puerto `8080:8080` para administración local.
*   **Volúmenes**: Mapeo del directorio `./infra/keycloak/realm` a `/opt/keycloak/data/import` en modo de lectura para asegurar la inmutabilidad de la configuración declarativa (IaC).

---

## 3. Especificación Detallada de Jerarquía de Roles (RBAC y Composite Roles)
La arquitectura de seguridad del DSS delega la jerarquía de roles (Role Hierarchy) completamente al Identity Provider (Keycloak) utilizando **Composite Roles**, manteniendo al Resource Server (Spring Boot) agnóstico de la jerarquía.

### Estrategia de Roles Compuestos
Se definen **Client Roles** en el cliente `uatf-auth-service` y se mapean a **Realm Roles** compuestos. Cuando un usuario inicia sesión, Keycloak expande estos roles compuestos inyectando todos los permisos heredados en el `access_token` dentro del claim `resource_access.uatf-auth-service.roles`.

### Segregación de Funciones (Separation of Duties)
En cumplimiento con el Principio de Mínimo Privilegio (PoLP):
* El rol técnico `SUPERADMIN` **no hereda roles de negocio académicos**. Un administrador IT no debe tener acceso automático a los dashboards académicos.
* La jerarquía aplica estrictamente a las autoridades académicas (`RECTOR` > `DECANO` > `DIRECTOR`).

| Realm Role (Global) | Hereda los Client Roles (`uatf-auth-service`) | Alcance Académico y Restricción (RNF4.1) |
| :--- | :--- | :--- |
| 👑 **`SUPERADMIN`** | `SUPERADMIN` | **Técnico Global**. Sin acceso a dashboards académicos. Gestión de usuarios y sistema. |
| 🎓 **`RECTOR`** | `RECTOR`, `DECANO`, `DIRECTOR` | **Negocio Global**. `faculty_id` y `career_id` deben ser `NULL` en el contexto local. |
| 🏛️ **`DECANO`** | `DECANO`, `DIRECTOR` | **Negocio Facultad**. `faculty_id` es obligatorio y `career_id` debe ser `NULL`. |
| 📚 **`DIRECTOR`** | `DIRECTOR` | **Negocio Carrera**. Tanto `faculty_id` como `career_id` son obligatorios. |

### Definición JSON de Roles Compuestos (`uatf-dss-realm-realm.json`)
Los Realm roles se configuran con `composite: true` referenciando a los Client Roles:
```json
{
  "roles": {
    "realm": [
      {
        "name": "SUPERADMIN",
        "description": "Rol de administración técnica global del sistema. Permite la gestión de usuarios y clientes.",
        "composite": true,
        "composites": {
          "client": { "uatf-auth-service": ["SUPERADMIN"] }
        },
        "clientRole": false
      },
      {
        "name": "RECTOR",
        "description": "Máxima autoridad ejecutiva de la UATF.",
        "composite": true,
        "composites": {
          "client": { "uatf-auth-service": ["RECTOR", "DECANO", "DIRECTOR"] }
        },
        "clientRole": false
      },
      {
        "name": "DECANO",
        "description": "Máxima autoridad de una Facultad.",
        "composite": true,
        "composites": {
          "client": { "uatf-auth-service": ["DECANO", "DIRECTOR"] }
        },
        "clientRole": false
      },
      {
        "name": "DIRECTOR",
        "description": "Autoridad ejecutiva de una carrera o programa académico.",
        "composite": true,
        "composites": {
          "client": { "uatf-auth-service": ["DIRECTOR"] }
        },
        "clientRole": false
      }
    ]
  }
}
```

---

## 4. Configuración de Clientes OIDC
Se configuran dos clientes principales bajo el Realm `uatf-realm`:

### A. Cliente Público: `uatf-dss-spa`
Utilizado por la interfaz de usuario web (Single Page Application) basada en React/Next.js.
*   **Tipo de Cliente**: Público (sin secreto de cliente, `publicClient: true`).
*   **Protocolo**: `openid-connect`.
*   **Flujo de Autorización**: Authorization Code Flow con PKCE obligado (`standardFlowEnabled: true`).
*   **Configuración de URLs**:
    *   `redirectUris`: `["http://localhost:3000/*"]`
    *   `webOrigins`: `["http://localhost:3000"]`
*   **Mapeadores**: Debe incluir los Realm Roles dentro del token de acceso (`access_token`) en la claim `realm_access.roles` para permitir que el frontend evalúe permisos en el cliente.

### B. Cliente Confidencial: `uatf-auth-service`
Utilizado por el Resource Server de Spring Boot para validación y, si fuera necesario, para interactuar con la Keycloak Admin REST API.
*   **Tipo de Cliente**: Confidencial (`publicClient: false`, requiere secreto).
*   **Flujos Habilitados**: `serviceAccountsEnabled: true` (Client Credentials Flow).
*   **Roles de Cuenta de Servicio**: Debe poseer el rol `view-users` y `manage-users` de la consola de administración del cliente `realm-management` para poder leer/escribir datos de usuarios en caso de sincronización activa de Keycloak.

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
  "realmId": "uatf-realm",
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
Una vez configurado el realm en la interfaz de Keycloak, se ejecuta la exportación dentro del contenedor:
```bash
docker exec -it uatf-keycloak /opt/keycloak/bin/kc.sh export \
  --realm uatf-realm \
  --file /opt/keycloak/data/import/uatf-realm-realm.json
```
Esto grabará el archivo en el volumen local `./infra/keycloak/realm/uatf-realm-realm.json`.

---

## 7. Criterios de Aceptación y Checklist (Definition of Done)
1. **Infraestructura Reproducible**: Al hacer `docker compose down -v` y `docker compose up -d`, Keycloak debe levantar automáticamente, importar el realm `uatf-realm`, configurar los clientes (`uatf-dss-spa`, `uatf-auth-service`) y definir los 4 roles globales (`SUPERADMIN`, `RECTOR`, `DECANO`, `DIRECTOR`) sin requerir intervención manual.
2. **Definición de Roles**: Los roles globales existen, tienen nombres en mayúsculas estrictas y descripciones microscópicas en español que describen con precisión su alcance académico.
3. **Mensajería Activa**: Crear, actualizar o asignar roles a un usuario produce un mensaje en `keycloak.user.events`; auth-service lo procesa una sola vez y conserva el snapshot de roles reconocidos.
4. **Resiliencia**: Con auth-service detenido, los eventos confirmados permanecen en la cola durable. Después de tres fallos de procesamiento, el evento se conserva en la DLQ para inspección y reproceso operativo.
5. **Seguridad de transporte**: Keycloak y auth-service usan credenciales internas de RabbitMQ; no existe secreto HTTP `X-Webhook-Secret` para esta integración.
