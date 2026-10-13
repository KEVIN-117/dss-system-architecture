# RabbitMQ

Compose arranca `rabbitmq:4.3-management`, con `RABBITMQ_DEFAULT_USER` y `RABBITMQ_DEFAULT_PASS` como cuenta inicial, volumen persistente local `infra/rabbitmq/data` y healthcheck de diagnóstico. AMQP `5672` y consola `15672` se publican solo en `127.0.0.1` para desarrollo.

| Variable | Quién la consume | Significado |
|---|---|---|
| `RABBITMQ_DEFAULT_USER` | Imagen RabbitMQ | Usuario bootstrap; Compose lo pasa a Keycloak/auth-service como `RABBITMQ_USERNAME`. |
| `RABBITMQ_DEFAULT_PASS` | Imagen RabbitMQ | Password bootstrap; secreto, se pasa como `RABBITMQ_PASSWORD`. |
| `RABBITMQ_HOST` | Provider Keycloak y auth-service | Host. `rabbitmq` en red Compose; `localhost` desde proceso en el host. |
| `RABBITMQ_PORT` | Provider y auth-service | Puerto AMQP; defecto 5672. No usar puerto de Management 15672. |
| `RABBITMQ_VHOST` | Provider y auth-service | Virtual host; defecto `/`. Debe existir y ser accesible para la cuenta. |

El provider publica mensajes persistentes a la cola durable `keycloak.user.events` y espera confirmación del broker. auth-service consume desde esa cola. La persistencia y retención durante una parada dependen también de que RabbitMQ siga activo, conserve su volumen y reciba correctamente el mensaje; monitorea cola y DLQ. El entorno actual no separa usuarios por publisher/consumer: en producción conviene cuentas y permisos mínimos por vhost/cola.

Por ambiente: dev usa la instancia Compose local; test usa broker descartable del Compose de integración; producción requiere nodo/cluster administrado, persistencia/backup, TLS y gestión de secretos.
