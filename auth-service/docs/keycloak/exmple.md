Para esta issue yo no empezaría creando cosas directamente en la consola de Keycloak. Primero convertiría la issue en una pequeña arquitectura reproducible y después implementaría en este orden: infraestructura → realm → clientes/roles → webhook → export/import → pruebas de aceptación.

Hay además dos puntos de la issue que conviene corregir antes de implementarla: Keycloak distingue entre User Events y Admin Events, y un usuario creado por un administrador genera un Admin Event, no simplemente un `REGISTER`. Además, Keycloak no trae un webhook HTTP genérico listo para usar; para llamar a `auth-service` necesitarás un Event Listener Provider/SPI personalizado o introducir un componente intermedio. La documentación oficial confirma que los eventos de usuario y los eventos administrativos son categorías distintas. ([Keycloak][1])

Yo plantearía la solución así:

```text
                         ┌─────────────────────┐
                         │      Keycloak       │
                         │    uatf-realm       │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
              uatf-dss-spa    uatf-auth-service   Roles
                  SPA          Resource Server    SUPERADMIN
                    │               │             RECTOR
                    │               │             DECANO
                    │               │             DIRECTOR
                    │               │
                    │               ▼
                    │        JWT validation
                    │
                    ▼
              Login / SSO
                    │
                    ▼
               Keycloak


                         Admin Event
                             │
                    USER CREATE / UPDATE
                             │
                             ▼
                   Custom Event Listener
                             │
                         HTTP POST
                             │
                             ▼
               http://auth-service:8080
                    /api/v1/auth/sync
                             │
                             ▼
                       auth-service
                             │
                             ▼
                 USER_ACADEMIC_CONTEXT
```

La clave es que Keycloak debe ser la fuente de verdad de identidad y roles, mientras que `auth-service` mantiene únicamente la información local necesaria para el dominio.

Primero definiría la estructura del proyecto.

Algo como:

```text
project-root/
│
├── docker-compose.yml
│
├── infra/
│   └── keycloak/
│       ├── realm/
│       │   └── uatf-realm-realm.json
│       │
│       └── providers/
│           └── uatf-keycloak-webhook.jar
│
├── services/
│   └── auth-service/
│
└── frontend/
    └── dss/
```

Aunque la issue menciona específicamente `uatf-realm-export.json`, yo recomiendo respetar la convención oficial si el archivo va a importarse automáticamente desde `/opt/keycloak/data/import`: `<realm-name>-realm.json`. Keycloak documenta que los archivos de realm destinados a importación desde directorio deben seguir esa convención. ([Keycloak][2])

Por tanto:

```text
infra/keycloak/realm/uatf-realm-realm.json
```

sería más apropiado.

La primera tarea sería levantar Keycloak.

Para desarrollo podemos usar:

```yaml
services:

  keycloak:
    image: quay.io/keycloak/keycloak:26.7
    container_name: uatf-keycloak

    command:
      - start-dev
      - --import-realm

    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin

    ports:
      - "8080:8080"

    volumes:
      - ./infra/keycloak/realm:/opt/keycloak/data/import

    networks:
      - uatf-network

networks:
  uatf-network:
    driver: bridge
```

El detalle importante aquí es `--import-realm`.

Keycloak busca los archivos JSON en `/opt/keycloak/data/import` cuando se inicia con `--import-realm`. Si el realm ya existe, el import automático se omite; esto está diseñado precisamente para evitar recrearlo en cada reinicio. ([Keycloak][2])

Por tanto, el ciclo será:

```text
docker compose up
        │
        ▼
Keycloak inicia
        │
        ▼
lee /opt/keycloak/data/import
        │
        ▼
uatf-realm-realm.json
        │
        ▼
crea uatf-realm
```

Después crearía el Realm.

El nombre debería quedar definido como una constante de infraestructura:

```text
uatf-realm
```

Y no utilizaría el `master` realm para la aplicación.

La separación sería:

```text
Keycloak
│
├── master
│   └── Administración de Keycloak
│
└── uatf-realm
    ├── Users
    ├── Roles
    ├── Clients
    ├── Groups
    ├── Sessions
    └── Identity configuration
```

Eso satisface la parte de "Realm aislado para el entorno UATF".

Luego configuraría los roles globales:

```text
SUPERADMIN
RECTOR
DECANO
DIRECTOR
```

Y aquí hay una decisión arquitectónica importante: deben ser Realm Roles, no Client Roles.

La issue dice explícitamente:

> roles globales

Por tanto:

```text
uatf-realm
│
└── Realm Roles
    ├── SUPERADMIN
    ├── RECTOR
    ├── DECANO
    └── DIRECTOR
```

Esto permite que los roles representen permisos globales de identidad y no permisos exclusivos de una aplicación.

Después viene el SPA.

Para el frontend utilizaría:

```text
Client ID:
uatf-dss-spa
```

y sería un cliente público con Authorization Code Flow + PKCE.

Conceptualmente:

```text
Browser
   │
   │ Authorization Request
   ▼
Keycloak
   │
   │ Login
   ▼
Authorization Code
   │
   ▼
SPA
   │
   │ Code + PKCE verifier
   ▼
Keycloak
   │
   ▼
Access Token
```

No recomiendo almacenar un `client_secret` en el frontend.

El cliente debería tener aproximadamente:

```text
Client ID:
    uatf-dss-spa

Client authentication:
    OFF

Standard flow:
    ON

Direct access grants:
    OFF

Valid redirect URIs:
    http://localhost:3000/*

Web origins:
    http://localhost:3000
```

En producción estos valores naturalmente cambiarían.

El siguiente sería el Resource Server.

Aquí haría una distinción importante respecto a la redacción de la issue.

`uatf-auth-service` puede ser un backend que tenga dos responsabilidades diferentes:

```text
uatf-auth-service
│
├── Resource Server
│      └── valida JWT
│
└── Backend Service
       └── consume Admin API / otras operaciones
```

Si el objetivo es que el backend simplemente valide tokens enviados por el frontend, no necesita autenticarse contra Keycloak mediante `client_credentials` para cada request.

La arquitectura sería:

```text
SPA
 │
 │ Authorization: Bearer JWT
 ▼
auth-service
 │
 │ valida JWT
 ▼
Spring Security
 │
 ├── issuer
 ├── signature
 ├── expiration
 └── roles
```

Para Spring Boot, esto encaja perfectamente con OAuth2 Resource Server.

Por otro lado, si `auth-service` necesita llamar a la Admin REST API de Keycloak, entonces sí necesitamos un cliente confidencial con Service Account. La documentación oficial muestra precisamente el uso de `client_id`, `client_secret`, `client_credentials` y service-account roles para autenticarse contra la Admin REST API. ([Keycloak][3])

Por eso yo separaría conceptualmente:

```text
uatf-auth-service
       │
       ├── Resource Server
       │       └── valida JWT
       │
       └── Keycloak Admin Client
               └── client_credentials
```

Incluso podría ser conveniente utilizar un client específico para administración, por ejemplo:

```text
uatf-auth-admin
```

en lugar de mezclar la identidad del Resource Server con la identidad utilizada para administración.

Ahora llegamos a la parte más delicada: el webhook.

Aquí cambiaría ligeramente la implementación propuesta por la issue.

La issue dice:

> cada vez que se cree o altere un usuario

y luego:

> `REGISTER` o actualización de perfil.

Esto mezcla dos tipos de eventos.

Keycloak tiene:

```text
User Events
├── REGISTER
├── LOGIN
├── UPDATE_PROFILE
└── ...

Admin Events
├── CREATE
├── UPDATE
├── DELETE
└── ...
```

Si el administrador crea un usuario desde la consola:

```text
Admin Console
      │
      ▼
CREATE USER
      │
      ▼
Admin Event
```

Por eso, para cumplir exactamente el DoD, el listener debería escuchar Admin Events de usuario.

La lógica podría ser:

```text
Admin Event
     │
     ├── resourceType == USER
     │
     ├── operationType == CREATE
     │
     └── operationType == UPDATE
              │
              ▼
       Webhook Dispatcher
              │
              ▼
        HTTP POST
              │
              ▼
       auth-service
```

Keycloak documenta que los Admin Events corresponden precisamente a acciones realizadas por administradores mediante Admin Console o Admin API, incluyendo crear y actualizar usuarios. ([Keycloak][1])

Aquí tenemos dos alternativas.

La primera es implementar un Event Listener SPI:

```text
Keycloak
   │
   ▼
EventListenerProvider
   │
   ▼
AdminEvent
   │
   ▼
WebhookClient
   │
   │ HTTP POST
   ▼
auth-service
```

Esta sería mi recomendación para esta issue porque el requerimiento explícitamente pide que Keycloak notifique al `auth-service`.

Keycloak proporciona un mecanismo SPI para implementar listeners personalizados y desplegarlos como JAR dentro de `providers/`. La documentación de desarrollo muestra este patrón para Event Listener Providers. ([Keycloak][3])

La segunda alternativa sería introducir un broker/event bus:

```text
Keycloak
    │
    ▼
Event Listener
    │
    ▼
RabbitMQ / Kafka
    │
    ▼
auth-service
```

Arquitectónicamente me gusta más para producción porque evita que Keycloak dependa directamente de la disponibilidad de `auth-service`.

Pero para esta issue, si el alcance es UATF/local development, probablemente sea innecesario. Podemos empezar con:

```text
Keycloak → HTTP → auth-service
```

y posteriormente evolucionar a:

```text
Keycloak → Event Bus → auth-service
```

si el proyecto lo requiere.

Hay otra consideración muy importante: no haría que el listener bloquee la operación de Keycloak esperando indefinidamente al `auth-service`.

Por ejemplo, esto sería peligroso:

```text
Admin creates user
       │
       ▼
Keycloak
       │
       │ HTTP POST
       ▼
auth-service
       │
       │ timeout 30s
       ▼
Keycloak operation delayed
```

Idealmente el listener debería manejar:

```text
timeout
retry
logging
idempotency
error handling
```

Y el endpoint:

```text
POST /api/v1/auth/sync
```

debería ser idempotente.

Yo definiría el payload del webhook desde ahora.

Por ejemplo:

```json
{
  "eventId": "uuid",
  "eventType": "USER_CREATED",
  "realm": "uatf-realm",
  "user": {
    "id": "keycloak-user-id",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "enabled": true
  },
  "timestamp": "2026-08-12T23:00:00Z"
}
```

Y para modificación:

```json
{
  "eventId": "uuid",
  "eventType": "USER_UPDATED",
  "realm": "uatf-realm",
  "user": {
    "id": "keycloak-user-id",
    "username": "john.doe",
    "email": "new@example.com"
  },
  "timestamp": "2026-08-12T23:05:00Z"
}
```

Esto es mucho mejor que enviar directamente el `AdminEvent` de Keycloak porque desacopla `auth-service` de la estructura interna de Keycloak.

Además agregaría un header de autenticación al webhook:

```text
X-Keycloak-Webhook-Signature
```

o, como mínimo:

```text
Authorization: Bearer <webhook-token>
```

En desarrollo podría ser algo simple:

```text
KEYCLOAK_WEBHOOK_SECRET=...
```

y en producción recomendaría firma HMAC.

La arquitectura sería:

```text
Keycloak
    │
    │ POST
    │ X-Keycloak-Webhook-Signature
    ▼
auth-service
    │
    ├── validate signature
    ├── validate event
    ├── idempotency
    └── synchronize user
```

Después viene la parte de IaC.

Aquí la issue está bien encaminada, pero hay que entender exactamente qué significa "exportar todo".

El export de Keycloak no debe considerarse un backup completo. La documentación oficial advierte que el export no contiene eventos de usuario/admin, sesiones persistidas, workflow state ni tokens revocados. ([Keycloak][2])

Para esta issue eso no es un problema porque queremos exportar configuración:

```text
Realm
Clients
Roles
Groups
Client scopes
Protocol mappers
Authentication configuration
Identity provider configuration
...
```

pero no queremos exportar el estado operacional de Keycloak.

El flujo de trabajo que recomiendo sería:

```text
1. Levantar Keycloak
        │
        ▼
2. Configurar Realm
        │
        ▼
3. Configurar Roles
        │
        ▼
4. Configurar Clients
        │
        ▼
5. Configurar Event Listener
        │
        ▼
6. Probar autenticación
        │
        ▼
7. Probar webhook
        │
        ▼
8. Exportar Realm
        │
        ▼
uatf-realm-realm.json
        │
        ▼
9. Commit al repositorio
```

Para exportar, Keycloak recomienda utilizar `kc.sh export` con el servidor detenido. También permite exportar específicamente un realm. ([Keycloak][2])

Por ejemplo:

```bash
kc.sh export \
  --realm uatf-realm \
  --file /tmp/uatf-realm-realm.json
```

Después colocamos:

```text
infra/keycloak/realm/uatf-realm-realm.json
```

Hay una cuestión adicional: los secretos.

No deberíamos hacer commit de:

```text
client secrets
admin passwords
database passwords
webhook secrets
```

El mecanismo de import/export permite utilizar placeholders de variables de entorno en los JSON de realm. La documentación oficial soporta referencias como `${MY_REALM_NAME}` dentro de la configuración exportada. ([Keycloak][2])

Así que la estrategia podría ser:

```text
uatf-realm-realm.json
        │
        ├── configuración
        ├── roles
        ├── clients
        └── placeholders
                 │
                 ▼
            environment
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
   secrets    URLs       passwords
```

Ahora sí podemos construir el `docker-compose.yml` definitivo.

La estructura conceptual sería:

```text
docker-compose
│
├── keycloak
│
├── keycloak-db
│
└── auth-service
```

y todos dentro de:

```text
uatf-network
```

para que Keycloak pueda resolver:

```text
http://auth-service:8080
```

Esto es importante: desde dentro del contenedor de Keycloak, `localhost` significa el propio contenedor de Keycloak.

Por tanto, esto:

```text
http://localhost:8080/api/v1/auth/sync
```

sería incorrecto si `auth-service` está en otro contenedor.

Debe ser:

```text
http://auth-service:8080/api/v1/auth/sync
```

exactamente como plantea la issue.

Yo dividiría la implementación en cinco subtareas.

Primera subtarea: `KEYCLOAK-01 — Keycloak Infrastructure`.

Resultado:

```text
docker-compose.yml
infra/keycloak/
```

Debe poder ejecutarse:

```bash
docker compose up -d
```

y aparecer Keycloak.

Segunda subtarea: `KEYCLOAK-02 — UATF Realm Configuration`.

Resultado:

```text
uatf-realm
```

con:

```text
SUPERADMIN
RECTOR
DECANO
DIRECTOR
```

y:

```text
uatf-dss-spa
uatf-auth-service
```

configurados correctamente.

Tercera subtarea: `KEYCLOAK-03 — Webhook Event Listener`.

Resultado:

```text
uatf-keycloak-webhook.jar
```

que procese:

```text
USER CREATE
USER UPDATE
```

y envíe:

```text
POST /api/v1/auth/sync
```

Cuarta subtarea: `KEYCLOAK-04 — Realm Export`.

Resultado:

```text
infra/keycloak/realm/uatf-realm-realm.json
```

Este archivo será el artefacto IaC principal.

Quinta subtarea: `KEYCLOAK-05 — End-to-End Validation`.

Y aquí probaría exactamente los tres criterios de aceptación.

Primera prueba:

```text
Browser
   │
   ▼
localhost:3000
   │
   ▼
Keycloak
   │
   ▼
Login
   │
   ▼
JWT
```

Decodificamos el JWT y comprobamos que contenga:

```json
{
  "realm_access": {
    "roles": [
      "DECANO"
    ]
  }
}
```

El nombre exacto de la claim dependerá de la configuración de protocol mappers/client scopes, por lo que no asumiría la estructura del token hasta verificar el realm exportado.

Segunda prueba:

```text
Admin Console
      │
      ▼
Create User
      │
      ▼
Keycloak Admin Event
      │
      ▼
Event Listener
      │
      ▼
POST /api/v1/auth/sync
      │
      ▼
auth-service
```

Y debemos comprobar no solamente que el evento aparezca en logs, sino que el `auth-service` realmente reciba el request.

Tercera prueba:

```text
docker compose down -v

docker compose up -d
```

y comprobar:

```text
uatf-realm             ✓
SUPERADMIN             ✓
RECTOR                 ✓
DECANO                 ✓
DIRECTOR               ✓
uatf-dss-spa            ✓
uatf-auth-service       ✓
event listener         ✓
```

La documentación señala que el import de startup no sobrescribe un realm que ya existe; para recrearlo completamente hay que eliminarlo o realizar un import explícito con las consideraciones correspondientes. ([Keycloak][2])

Por tanto, para demostrar realmente el criterio:

> "Se puede destruir completamente el contenedor de Keycloak y levantarlo de nuevo"

yo usaría una base de datos efímera en el escenario de prueba:

```text
docker compose down -v
```

Así eliminamos:

```text
Keycloak
PostgreSQL
volúmenes
```

y después:

```text
docker compose up -d
```

El único origen de configuración será:

```text
infra/keycloak/realm/uatf-realm-realm.json
```

Eso demuestra de verdad que tenemos IaC.

Finalmente, hay una mejora que considero importante para la issue antes de cerrarla. Cambiaría esta parte:

> "cada vez que se cree o altere un usuario"

por algo más preciso:

```text
Keycloak debe emitir un evento de sincronización cuando un usuario
sea creado o actualizado mediante operaciones administrativas.

El Event Listener deberá procesar Admin Events cuyo resourceType sea
USER y cuyo operationType sea CREATE o UPDATE.

Opcionalmente, User Events como REGISTER y UPDATE_PROFILE podrán
procesarse posteriormente si también se requiere sincronización de
cambios realizados directamente por el usuario.
```

Eso elimina una ambigüedad importante.

En resumen, la implementación que yo seguiría es:

```text
                  ┌───────────────────────┐
                  │     docker-compose    │
                  └───────────┬───────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
          PostgreSQL                 Keycloak 26.x
                                           │
                                     uatf-realm
                                           │
                     ┌─────────────────────┼─────────────────────┐
                     │                     │                     │
                     ▼                     ▼                     ▼
                 SPA Client          Auth Service          Realm Roles
              uatf-dss-spa        uatf-auth-service      SUPERADMIN
                     │                     │                RECTOR
                     │                     │                DECANO
                     │                     │                DIRECTOR
                     │                     │
                     ▼                     ▼
                  OIDC                 Resource Server
                     │                     │
                     └──────────┬──────────┘
                                │
                              JWT
                                │
                                ▼
                         Spring Security


                         Admin Event
                              │
                              ▼
                     Event Listener SPI
                              │
                              ▼
                         HTTP Webhook
                              │
                              ▼
                     auth-service:/sync
                              │
                              ▼
                  USER_ACADEMIC_CONTEXT


                       Git Repository
                              │
                              ▼
               infra/keycloak/realm/
                     uatf-realm-realm.json
                              │
                              ▼
                       --import-realm
```

Esta sería una implementación bastante sólida para la issue y, sobre todo, deja una separación clara entre **identidad (Keycloak)**, **autorización (roles/tokens)**, **datos propios del dominio (`auth-service`)** e **infraestructura reproducible (Docker + Realm JSON)**.

El siguiente paso que haría es construir primero el `docker-compose.yml` y la estructura de `infra/keycloak`, y después definir exactamente el contenido de `uatf-realm-realm.json`; una vez estabilizado eso, implementamos el SPI del webhook. Ese orden evita que terminemos escribiendo código Java para el listener antes de tener definido el contrato de eventos y la infraestructura donde va a ejecutarse.

[1]: https://www.keycloak.org/docs/latest/server_admin/?utm_source=chatgpt.com "Server Administration Guide"
[2]: https://www.keycloak.org/server/importExport?utm_source=chatgpt.com "Importing and exporting realms - Keycloak"
[3]: https://www.keycloak.org/docs/latest/server_development/index.html?utm_source=chatgpt.com "Server Developer Guide"
