# Keycloak

## Configuración del contenedor

El Compose raíz utiliza `KC_BOOTSTRAP_ADMIN_USERNAME` y `KC_BOOTSTRAP_ADMIN_PASSWORD` para el administrador inicial. La conexión JDBC se fija en el comando: PostgreSQL, `auth-service-db:5432/dss_identity`, esquema `keycloak`, con `KC_DB_USERNAME` y `KC_DB_PASSWORD`. El servicio escucha dentro del contenedor en 8080 y publica loopback host 8080; health/metrics se publica en loopback 9000.

`KEYCLOAK_BFF_CLIENT_SECRET` es secreto del cliente confidencial BFF. Se exige al interpolar Compose, se utiliza también al importar la configuración del realm y debe coincidir con el secreto provisionado en Keycloak. No es el secreto de sesión del BFF.

## Provider de eventos

El provider usa `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` y `RABBITMQ_VHOST`. Compose inyecta las credenciales desde `RABBITMQ_DEFAULT_USER/PASS`; dentro de Docker usa `rabbitmq:5672` y vhost `/`. La publicación no usa una URL HTTP al auth-service: RabbitMQ desacopla temporalmente la disponibilidad de ambos servicios.

## Por ambiente

- **Dev:** `start-dev`, realm importado, puerto host limitado a loopback. Issuer accesible para auth-service por `http://keycloak:8080/realms/<realm>`.
- **Prueba/integración:** realm y provider de prueba con broker de fixture; URLs accesibles en la red de prueba.
- **Producción:** no usar `start-dev`; configurar proxy/hostname/TLS, bootstrap y DB con secretos administrados, broker privado y credenciales restringidas. El Compose actual está orientado a desarrollo y no es una plantilla de despliegue productivo completa.

Las variables `KC_DB`, `KC_DB_URL`, `KC_DB_SCHEMA`, y pool aparecen en `.env.example`, pero el Compose actual fija motor, URL y schema mediante argumentos; no asumir que cambiarlas en `.env` cambia el comando actual.
