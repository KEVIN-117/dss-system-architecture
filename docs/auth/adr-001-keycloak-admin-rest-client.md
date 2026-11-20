# ADR-001: Cliente de la Keycloak Admin REST API en auth-service

- **Estado:** aceptada
- **Fecha:** 2026-11-19
- **Issue:** IAM-003 (#273), épica #290

## Contexto

auth-service tiene que administrar usuarios, roles, permisos y clientes de Keycloak para el admin-portal (decisiones D1–D4 de [rbac-iam-admin-proposal.md](rbac-iam-admin-proposal.md)). Había dos opciones:

1. **`org.keycloak:keycloak-admin-client`**, el cliente oficial.
2. **`RestClient` de Spring Framework 7**, con representaciones propias.

Condicionantes del servicio:

- **Spring Boot 4.1:** usa **Jackson 3** (`tools.jackson`) como mapper principal.
- **`keycloak-admin-client`:**
  - Trae RESTEasy Client y depende de Jackson 2.
  - Su versión debe seguir a la del servidor (26.7.x).
  - Mete al classpath un segundo stack JAX-RS/Jackson y obliga a actualizarlo junto con Keycloak.
- **Arquitectura:** es hexagonal y está verificada con ArchUnit. Los casos de uso dependen de puertos, no del cliente concreto.
- **Uso:** se necesita un subconjunto pequeño de la API (users, roles, role-mappings, composites, clients, client-secret).

## Decisión

Usar **`RestClient`** (Spring Framework 7) sobre `JdkClientHttpRequestFactory`, con representaciones propias mínimas (`KeycloakRepresentations`) en `adapter/out/keycloak`.

- **Token:** `client_credentials` del cliente `uatf-auth-service`, cacheado hasta 30 s antes de su expiración. Ante un 401 se renueva una vez.
- **Timeouts:** de conexión y de lectura, configurables (2 s y 5 s por defecto).
- **Reintentos:** acotados (2 por defecto) con backoff exponencial, solo en llamadas idempotentes (GET/PUT/DELETE) y ante errores de red o 502/503/504. POST nunca se reintenta.
- **Errores:** los de Keycloak se traducen a excepciones de dominio:
  - 400 → 400
  - 404 → 404
  - 409 → 409
  - 403, 5xx o un 401 persistente → 502
  - Indisponibilidad o falta de configuración → 503
- **JSON:** se envía en UTF-8. Los campos `null` se omiten, de modo que las actualizaciones son parciales.
- **Secretos:** ni el secreto ni el token se registran. Los `toString()` de propiedades, tokens y credenciales los enmascaran.

## Consecuencias

- **Positivas:**
  - Sin dependencias nuevas ni conflicto con Jackson 3.
  - Un solo stack HTTP en el servicio.
  - El comportamiento ante fallos es explícito y queda cubierto con tests (`KeycloakAdminHttpClientTest`, `KeycloakAdminTimeoutTest`).
- **Negativas:**
  - Las representaciones de Keycloak se mantienen a mano.
  - Si una actualización de Keycloak cambia la API, lo detecta `KeycloakAdminAdapterIntegrationTest`, que corre contra `quay.io/keycloak/keycloak:26.7.4` con el realm del repositorio. Al subir la versión de Keycloak hay que subir también la imagen del test.
- **Extensión:** las operaciones nuevas se agregan como métodos del adaptador detrás de los puertos `Identity*Port`. Ningún caso de uso conoce `RestClient` ni Keycloak.
