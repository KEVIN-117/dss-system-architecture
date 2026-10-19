# Variables globales y configuración por ambiente

## Archivo `.env` raíz

Docker Compose carga `.env` para interpolar `docker-compose.yml`; no es automáticamente el entorno de cada proceso. Compose pasa solo las variables declaradas en `environment`. Mantén `.env` local ignorado y parte de `.env.example`.

| Variable | Requerida | Uso y notas |
|---|---|---|
| `POSTGRES_DW_USER` | Sí | Usuario inicial de `postgres-dw`. Usa un propietario solo para desarrollo/migraciones; runtime debe tener privilegios restringidos. |
| `POSTGRES_DW_PASSWORD` | Sí, secreto | Contraseña del usuario DW. |
| `POSTGRES_DW_NAME` | Sí | Nombre de la base DW; usado por Postgres, `dw-migrator` y Hop. |
| `POSTGRES_TX_USER` | Sí | Usuario OLTP en la plantilla; su uso depende del servicio/fixture que conecte a la fuente. No conceder escritura a Hop. |
| `POSTGRES_TX_PASSWORD` | Sí, secreto | Credencial del OLTP. |
| `POSTGRES_TX_NAME` | Sí | Base OLTP (por ejemplo Jachasun). |
| `POSTGRES_TX_HOST`, `POSTGRES_TX_PORT` | En el `.env` local | Presente en la configuración local, pero no está en `.env.example` ni lo consume el Compose raíz actual. No tratarlo como contrato compartido hasta reconciliar plantillas. |
| `HOP_DW_USER`, `HOP_DW_PASS` | Solo `.env` local | No están en la plantilla actual ni en Compose raíz. El Hop usa usuarios en los perfiles JSON (`DSS_DW_USERNAME/PASSWORD`). No depender de estas variables obsoletas. |
| `DB_DW_HOST`, `DB_DW_PORT` | Sí para Hop | Dirección del DW desde Hop. `host.docker.internal:5434` corresponde al desarrollo local si el DW está publicado en el host. |
| `DB_TX_HOST`, `DB_TX_PORT` | Sí para Hop | Dirección OLTP vista por Hop. Usar DNS de servicio si comparte red; host/puerto local solo cuando corresponda. |
| `HOP_ENVIRONMENT_NAME` | Sí para Hop | Perfil Hop activo: `dev`, `test`, `integration` o `prod`. |
| `HOP_WEB_PORT` | Opcional | Puerto del host enlazado a Hop Web; defecto 8081, ligado a loopback en Compose. |
| `KC_BOOTSTRAP_ADMIN_USERNAME` | Sí en primer arranque | Usuario administrador bootstrap de Keycloak. No es un usuario de aplicación. |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | Sí, secreto | Contraseña bootstrap. Guardar en secret store y rotar según operación. |
| `KC_DB`, `KC_DB_URL`, `KC_DB_SCHEMA` | Compose los fija | Motor, JDBC y esquema de Keycloak. La URL raíz actual apunta a `auth-service-db`/`dss_identity`/`keycloak`. |
| `KC_DB_USERNAME`, `KC_DB_PASSWORD` | Sí | Credenciales de Keycloak para el esquema de identidad. No confundir con el usuario de la aplicación `AUTH_DB_USER`. |
| `KC_DB_POOL_INITIAL_SIZE`, `KC_DB_POOL_MIN_SIZE`, `KC_DB_POOL_MAX_SIZE` | Perfil Keycloak | Pool documentado en el ejemplo; comprobar soporte y configuración efectiva de la imagen antes de cambiarlo. No se interpolan actualmente en el Compose raíz. |
| `KEYCLOAK_BFF_CLIENT_SECRET` | Sí, secreto | Secreto del cliente confidencial BFF en realm import/runtime. Compose valida que no esté vacío. |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_VHOST` | Sí/valores por defecto | Endpoint compartido por provider y auth-service. En Compose: `rabbitmq:5672`, vhost `/`; desde host, `localhost:5672`. |
| `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS` | Sí, la segunda secreta | Crea la cuenta inicial del broker; Compose la inyecta como `RABBITMQ_USERNAME/PASSWORD` en Keycloak y auth-service. |
| `AUTH_DB_USER`, `AUTH_DB_PASSWORD`, `AUTH_DB_NAME` | Sí | Bootstrap de PostgreSQL IAM. El password es secreto. |
| `AUTH_SPRING_PROFILE_ACTIVE` | Sí | Compose lo pasa como `SPRING_PROFILE_ACTIVE`; valores esperados `dev` o `prod`. |
| `AUTH_SERVER_PORT`, `AUTH_DB_URI` | Sí | Puerto y JDBC de auth-service. En Docker la URL usa `auth-service-db:5432`. |
| `AUTH_KEYCLOAK_ISSUER_URI`, `AUTH_KEYCLOAK_JWK_SET_URI` | Sí | Realm y endpoint de claves visibles por auth-service. Deben coincidir con issuer/audience de los tokens. |
| `AUTH_KEYCLOAK_RESOURCE_ID`, `AUTH_KEYCLOAK_AUDIENCE` | Sí / opcional | Identificador de recurso y audiencia JWT. Si no se indica la segunda, Compose la deriva del resource ID. |
| `AUTH_KEYCLOAK_PRINCIPAL_ATTRIBUTE` | Sí | Claim usado como principal; en el ejemplo `preferred_username`. |
| `AUTH_CORS_ALLOWED_ORIGINS` | Perfil según ambiente | Orígenes exactos de navegador separados por coma. En producción deben ser HTTPS y no usar `*`. |
| `OLAP_PORT` | Opcional | Puerto local de Saiku publicado por Compose; default 8088 porque Keycloak usa 8080. El bind se limita a `127.0.0.1`. |

## Perfiles

| Ambiente | Base de configuración | Endpoints típicos | Reglas |
|---|---|---|---|
| Desarrollo local | `.env.example`, `application-dev.yaml`, `dev-env.example.json` | `localhost` desde host; DNS Docker (`keycloak`, `rabbitmq`, `auth-service-db`) desde contenedores | Swagger puede habilitarse; CORS permite los portales locales; secretos ficticios solo para probar. |
| Prueba | `application-test.yaml` y ejemplos `test`/`integration-test` | Servicios efímeros o fixtures aislados | Usar cuentas de fixture de privilegio mínimo y datos descartables. No reutilizar producción. |
| Integración | `integration-env.example.json`, `integration-test.example.json` | Red de Compose de integración y contenedores de fixtures | Variables versionadas deben ser ficticias; credenciales reales se inyectan por runner/secret store. |
| Producción | `application-prod.yaml`, `prod-env.example.json` | DNS privado, endpoints reales aprobados | HTTPS, secretos externos, cuentas runtime restringidas, Swagger deshabilitado en auth-service y CORS limitado. Nunca cargar `prod` en Hop Web local. |

Los perfiles son por componente; no existe un único archivo versionado que resuelva automáticamente todos los ambientes. Revisa el documento de cada servicio para las diferencias y valores predeterminados concretos.

## Secretos y operación

Secretos incluyen passwords de base de datos, RabbitMQ, Keycloak, sesión BFF, claves API y credenciales JDBC Hop. En local van en archivos ignorados; en CI/CD y producción deben provenir de secretos protegidos. No imprimir `docker compose config` completo ni `env` de contenedores, porque ambos pueden revelar credenciales. Rota cualquier secreto que haya quedado registrado accidentalmente.
