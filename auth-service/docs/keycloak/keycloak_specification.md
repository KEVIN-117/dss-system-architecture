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

## 3. Especificación Detallada de Roles Globales (Realm Roles)
Los roles del sistema son globales (Realm Roles) y determinan la jerarquía de acceso y la granularidad académica de los datos en el DSS (Decision Support System) de la UATF.

| Nombre del Rol | Identificador Único (Nombre) | Descripción Microscópica | Alcance Académico y Restricción (RNF4.1) |
| :--- | :--- | :--- | :--- |
| **Super Administrador** | `SUPERADMIN` | Rol de administración técnica global del sistema. Permite la gestión de usuarios, roles, clientes y la visualización de auditorías del sistema. | Global. Sin restricciones académicas. |
| **Rector** | `RECTOR` | Máxima autoridad ejecutiva de la universidad UATF. Permite el acceso consolidado a métricas, reportes y dashboards a nivel institucional total. | Global. Sin restricciones. `faculty_id` y `career_id` deben ser `NULL` en el contexto local. |
| **Decano** | `DECANO` | Máxima autoridad de una Facultad. Permite el acceso consolidado de todas las carreras y programas que pertenezcan única y exclusivamente a su Facultad asignada. | Restringido por Facultad. `faculty_id` es obligatorio y `career_id` debe ser `NULL`. |
| **Director de Carrera** | `DIRECTOR` | Autoridad ejecutiva de una carrera o programa académico. Permite el acceso consolidado a nivel de la carrera bajo su administración. | Restringido por Carrera. Tanto `faculty_id` como `career_id` son obligatorios. |

### Definición JSON de Roles para Exportación (`uatf-realm-realm.json`)
Los roles se declaran en el nodo principal del JSON de importación del Realm de la siguiente manera:
```json
{
  "roles": {
    "realm": [
      {
        "name": "SUPERADMIN",
        "description": "Rol tecnico global para administracion, configuracion de clientes y auditoria del sistema DSS-UATF.",
        "composite": false,
        "clientRole": false
      },
      {
        "name": "RECTOR",
        "description": "Maxima autoridad universitaria de la UATF. Acceso global ilimitado a reportes y analiticas.",
        "composite": false,
        "clientRole": false
      },
      {
        "name": "DECANO",
        "description": "Autoridad de Facultad. Acceso restringido a reportes e informacion consolidada de su respectiva facultad.",
        "composite": false,
        "clientRole": false
      },
      {
        "name": "DIRECTOR",
        "description": "Autoridad de Carrera. Acceso restringido exclusivamente a las metricas y analiticas de la carrera bajo su direccion.",
        "composite": false,
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

## 5. Mecanismo de Sincronización Webhook (Admin Events)
Para sincronizar las altas y modificaciones de usuarios realizadas en la consola administrativa de Keycloak hacia `auth-service`, se implementará un flujo de eventos asíncrono.

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
Custom Event Listener SPI (uatf-keycloak-webhook)
         |
         +--> [POST HTTP] --> http://auth-service:8080/api/v1/auth/sync
```

### Contrato del Webhook (`POST /api/v1/auth/sync`)

#### Headers Obligatorios:
*   `Content-Type: application/json`
*   `Authorization: Bearer <webhook-shared-secret>` (Llave compartida y configurada mediante variables de entorno para evitar accesos no autorizados al endpoint).

#### Payload del Evento (Ejemplo `USER_CREATED`):
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
    "isActive": true
  }
}
```

#### Payload del Evento (Ejemplo `USER_UPDATED`):
```json
{
  "eventId": "87c4f4a3-448f-4ee6-85fb-5b12da6f23e4",
  "realmId": "uatf-realm",
  "eventType": "USER_UPDATED",
  "timestamp": 1786582755000,
  "user": {
    "keycloakId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "username": "krodriguez",
    "email": "kevin.rodriguez.upd@uatf.edu.bo",
    "firstName": "Kevin",
    "lastName": "Rodriguez",
    "isActive": true
  }
}
```

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
3. **Webhook Activo**: La creación de un usuario en Keycloak a través de la consola administrativa dispara el listener HTTP que invoca el endpoint de sincronización del `auth-service`.
