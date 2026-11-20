# auth-service

Fuentes: `auth-service/src/main/resources/application.yaml`, `application-dev.yaml`, `application-prod.yaml`, `src/test/resources/application-test.yaml`, `auth-service/.env.example` y servicio Compose raíz.

| Variable | Requerida | Uso / default |
|---|---|---|
| `SPRING_PROFILE_ACTIVE` | Sí | Perfil Spring; default del YAML `dev`. Compose toma `AUTH_SPRING_PROFILE_ACTIVE`. |
| `SERVER_PORT` | Opcional | Puerto HTTP, default 8080; Compose publica host 8000 al puerto configurado. |
| `API_VERSION` | Opcional | Prefijo servlet, default `v1`, dando `/api/v1`. |
| `DB_URI`, `DB_USERNAME`, `DB_PASSWORD` | Sí | URL JDBC, usuario y secreto PostgreSQL. Compose mapea `AUTH_DB_URI`, `AUTH_DB_USER`, `AUTH_DB_PASSWORD`. |
| `KEYCLOAK_ISSUER_URI` | Sí | Issuer que debe coincidir con el claim `iss`; usado por resource server. |
| `KEYCLOAK_JWK_SET_URI` | Dev/test/Compose | Endpoint de claves públicas; en `dev` se proporciona explícitamente. En prod el perfil declara issuer y confía en resolución OIDC. |
| `KEYCLOAK_RESOURCE_ID` | Opcional | Cliente/recurso esperado por conversor JWT; default `uatf-auth-service`. |
| `KEYCLOAK_AUDIENCE` | Opcional | Audiencia JWT; deriva del resource ID si falta. |
| `KEYCLOAK_PRINCIPAL_ATTRIBUTE` | Opcional | Claim para el principal; default `preferred_username`. |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST` | Sí fuera de defaults local | Conexión al broker; host `localhost`, port 5672, credenciales guest y vhost `/` como fallback del YAML. En Compose usa credenciales default inyectadas. |
| `AUTH_CORS_ALLOWED_ORIGINS` | Sí en prod | Lista coma-separada de orígenes permitidos; el perfil prod exige HTTPS. Dev tiene fallback localhost. |
| `AUTH_API_DOCS_ENABLED` | Opcional | Habilita Swagger/OpenAPI; base false, dev true, prod false. |
| `AUTH_CONTEXT_READER_CLIENTS` | Opcional | Lista coma-separada de clientes Keycloak (claim `azp`) que pueden llamar `GET /internal/users/{keycloakId}/academic-contexts`; default `olap-service`. Además del `azp`, el token debe traer el permiso `dss-permissions: context:read`. |
| `KEYCLOAK_PERMISSIONS_CLIENT_ID` | Opcional | Cliente catálogo cuyos roles de cliente son permisos (`recurso:acción`); default `dss-permissions`. `JwtConverter` los convierte en authorities sin prefijo. |
| `KEYCLOAK_ADMIN_BASE_URL` | Sí en Compose/prod | URL de Keycloak para la Admin REST API, sin realm (`http://keycloak:8080` en Compose; default del YAML `http://localhost:8080`). Compose toma `AUTH_KEYCLOAK_ADMIN_BASE_URL`. |
| `KEYCLOAK_ADMIN_REALM` | Opcional | Realm que se administra; default `uatf-dss-realm`. Compose toma `AUTH_KEYCLOAK_ADMIN_REALM`. |
| `KEYCLOAK_AUTH_SERVICE_CLIENT_ID` | Opcional | Cliente confidencial cuya cuenta de servicio llama a la Admin API; default `uatf-auth-service`. |
| `KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET` | Sí, secreto | Secreto de ese cliente (el mismo que usa el import del realm). Compose lo exige. Si falta fuera de Compose, el servicio arranca pero toda operación de administración de identidad responde 503. Nunca se registra en logs. |
| `KEYCLOAK_ADMIN_CONNECT_TIMEOUT`, `KEYCLOAK_ADMIN_READ_TIMEOUT` | Opcional | Timeouts hacia Keycloak; default `2s` y `5s`. |
| `KEYCLOAK_ADMIN_MAX_RETRIES` | Opcional | Reintentos extra para llamadas idempotentes (GET/PUT/DELETE) ante errores de red o 502/503/504; default `2`. POST nunca se reintenta. |
| `IAM_CLIENTS_REQUIRE_HTTPS` | Opcional | Exige `https` en las redirect URIs, las post-logout URIs y los web origins de las aplicaciones que se registran o editan (salvo loopback); default `false`. El perfil `prod` lo fija en `true`. |
| `IAM_INVITATION_LIFESPAN` | Opcional | Vigencia de los enlaces del correo de invitación y de acciones requeridas (`app.iam.invitation-lifespan`); default `72h`. |

### Administración de identidad (Keycloak Admin REST API)

Desde IAM-003, auth-service obtiene un token `client_credentials` de `uatf-auth-service` y lo cachea hasta 30 s antes de su expiración. Con ese token llama a `/admin/realms/{realm}/...` a través del adaptador `adapter/out/keycloak`, que implementa los puertos `IdentityUserAdminPort`, `IdentityRoleAdminPort`, `IdentityRoleMappingPort` e `IdentityClientAdminPort`. Los privilegios de la cuenta de servicio están en `docs/envs/keycloak.md`, y la elección de `RestClient` frente a `keycloak-admin-client` en `docs/auth/adr-001-keycloak-admin-rest-client.md`.

Traducción de errores de Keycloak a excepciones de dominio:

| Respuesta de Keycloak | Excepción | HTTP |
|---|---|---|
| 400 | `IdentityRequestRejectedException` | 400 |
| 404 | `IdentityResourceNotFoundException` | 404 |
| 409 | `IdentityResourceConflictException` | 409 |
| 401 tras renovar el token, 403 u otros 5xx | `IdentityProviderException` | 502 |
| Timeout, conexión rechazada o secreto ausente | `IdentityProviderUnavailableException` | 503 |

### Administración de usuarios (IAM-006)

`/api/v1/admin/iam/users` crea usuarios en Keycloak, los actualiza o desactiva, reenvía invitaciones y reemplaza sus roles y permisos directos. Las lecturas exigen `iam:users:read` y las escrituras `iam:users:write`. Requisitos del entorno:

- La cuenta de servicio de `uatf-auth-service` con los roles de `realm-management` de IAM-001 y `KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET` configurado.
- **SMTP configurado en el realm** (Realm settings → Email) para que lleguen las invitaciones y los correos de restablecimiento. Sin SMTP, crear usuarios funciona, pero `invitationSent` vuelve `false` y `actions-email` responde 502.

### Roles y permisos (IAM-007)

`/api/v1/admin/iam/roles` y `/api/v1/admin/iam/permissions` crean, editan y eliminan roles del realm y permisos de `dss-permissions`, y definen qué permisos agrupa cada rol (`iam:roles:read` / `iam:roles:write`). No requieren variables nuevas: usan la cuenta de servicio de IAM-001, que necesita `manage-realm` para escribir roles del realm y `manage-clients` para los permisos.

### Aplicaciones (IAM-008)

`/api/v1/admin/iam/clients` registra y edita aplicaciones (clientes OAuth) y rota sus secretos (`iam:clients:read` / `iam:clients:write`). Usa la cuenta de servicio de IAM-001, con `manage-clients`. Los secretos se muestran una sola vez y nunca se guardan en la auditoría ni en los logs.

### Auditoría administrativa

`GET /api/v1/admin/iam/audit` (permiso `iam:audit:read`) consulta `admin_audit_log`, de lo más reciente a lo más antiguo, con filtros opcionales `actor` (Keycloak id o username), `action`, `targetType`, `targetId`, `outcome`, `from`/`to` (ISO-8601; `from` incluido, `to` excluido) y paginación `page`/`size` (máximo 100). No requiere variables nuevas. El detalle de cómo se registra cada operación está en `auth-service/docs/auth-service-funcionamiento.md`.

### Endpoint interno de alcance académico

`GET /api/v1/internal/users/{keycloakId}/academic-contexts` devuelve `{keycloakId, active, roles, contexts}` (todos los contextos del usuario, que pueden ser varios desde IAM-009) sin datos personales y con `Cache-Control: no-store`. Es solo servicio-a-servicio (backstop OLAP, ver `docs/olap/academic-scope-backstop-design.md`); el BFF no lo expone. Respuestas: 401 sin token, 403 sin el permiso `context:read` o con un `azp` no permitido, 404 si el usuario no está sincronizado.

### Diferencias por perfil

- **dev:** PostgreSQL y Keycloak configurados por variables; Swagger visible; CORS local. El YAML actual pone SQL logging/debug detallado, no debe trasladarse a producción.
- **test:** propiedades definidas en `application-test.yaml`; el usuario de prueba debe ser descartable.
- **prod:** Swagger apagado, CORS requiere HTTPS, issuer OIDC y RabbitMQ requeridos. Usa secretos y endpoints productivos aprobados.

Compose usa nombres de servicio para conexiones internas. No apuntar `DB_URI`/issuer al `localhost` del contenedor.
