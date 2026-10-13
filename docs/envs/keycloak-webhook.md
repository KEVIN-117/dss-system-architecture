# keycloak-webhook

El provider se carga dentro del proceso Keycloak; no es un contenedor o proceso independiente en el Compose actual. La fábrica lee la configuración de RabbitMQ del entorno del contenedor Keycloak.

| Variable | Requerida | Uso |
|---|---|---|
| `RABBITMQ_HOST` | Sí | Host del broker desde el contenedor Keycloak (`rabbitmq` en Compose). |
| `RABBITMQ_PORT` | Opcional | Puerto AMQP; defecto 5672. |
| `RABBITMQ_USERNAME` | Sí | Usuario autorizado para publicar a la cola; Compose usa `RABBITMQ_DEFAULT_USER`. |
| `RABBITMQ_PASSWORD` | Sí, secreto | Credencial del publisher; Compose usa `RABBITMQ_DEFAULT_PASS`. |
| `RABBITMQ_VHOST` | Opcional | Vhost AMQP; default `/`. |

La cola de publicación es `keycloak.user.events`. Mantener el provider y el consumidor de auth-service con el mismo vhost y contrato de mensaje. Dev usa broker local; test usa broker efímero; producción requiere conexión privada/TLS y credencial de publisher de privilegio mínimo. No existe una URL/secreto webhook HTTP en el flujo RabbitMQ actual; `KEYCLOAK_WEBHOOK_SECRET` que aún pueda existir en archivos locales es obsoleto, no se consume y debe retirarse de la configuración activa.
