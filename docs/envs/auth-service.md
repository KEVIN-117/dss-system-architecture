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

### Diferencias por perfil

- **dev:** PostgreSQL y Keycloak configurados por variables; Swagger visible; CORS local. El YAML actual pone SQL logging/debug detallado, no debe trasladarse a producción.
- **test:** propiedades definidas en `application-test.yaml`; el usuario de prueba debe ser descartable.
- **prod:** Swagger apagado, CORS requiere HTTPS, issuer OIDC y RabbitMQ requeridos. Usa secretos y endpoints productivos aprobados.

Compose usa nombres de servicio para conexiones internas. No apuntar `DB_URI`/issuer al `localhost` del contenedor.
