# Guía de despliegue UATF desde Docker Hub

**Sistema:** DSS UATF
**Versión de imágenes documentada:** `1.0.0`
**Fecha de esta guía:** 20 de octubre de 2026

## 1. Alcance y estado

Esta guía cubre el despliegue de las cuatro imágenes publicadas por el proyecto:

| Componente | Imagen | Tag de release |
|---|---|---|
| IAM / Auth Service | `kevin117rodriguez/dss-auth-service:1.0.0` | `1.0.0` |
| Proveedor de identidad | `kevin117rodriguez/dss-keycloak:1.0.0` | `1.0.0` |
| API OLAP / Saiku | `kevin117rodriguez/dss-olap-service:1.0.0` | `1.0.0` |
| Apache Hop Web + proyecto ETL UATF | `kevin117rodriguez/dss-apache-hop:1.0.0` | `1.0.0` |

Las imágenes se publican en [Docker Hub](https://hub.docker.com/u/kevin117rodriguez). El tag de release es el recomendado para un despliegue reproducible; no usar `latest` como referencia operativa. Confirmar la versión aprobada en el release de GitHub y en la pestaña **Tags** de cada repositorio antes de cada instalación.

**Estas cuatro imágenes no forman por sí solas todo el DSS.** Se requieren servicios y artefactos operativos adicionales: PostgreSQL para IAM/Keycloak y DW, RabbitMQ, una base OLTP Jachasun accesible por Hop, las migraciones DW, el archivo de ambiente de Hop, y los archivos de catálogo OLAP. Los portales web, BFF, gateway, prediction service y ETL load manager no están incluidos en estas cuatro imágenes.

El `docker-compose.yml` raíz del repositorio es de desarrollo: incluye `build:` local, puertos de loopback, `start-dev` para Keycloak y montajes de fuentes. **No debe copiarse directamente como Compose productivo.** Esta guía define los contratos de ejecución de las imágenes; antes del cambio a producción UATF debe aprobar dominios, TLS, redes, base de datos, cuentas, secretos, backups y protección de Hop Web.

## 2. Arquitectura y comunicación

```text
 Navegadores / portales UATF
              |
        HTTPS + proxy
              |
       +------+---------------------+
       |                            |
       v                            v
 Keycloak (8080)              auth-service (8080)
       |                            |       |
       | OIDC/JWKS                  |       +--> RabbitMQ (5672)
       |                            |                 ^
       +----------------------------+                 |
       PostgreSQL IAM (5432) <------------------------+
            ^                  eventos de usuario
            |
          Keycloak

 Apache Hop Web (8080) --JDBC/solo lectura--> OLTP Jachasun
          |
          +--JDBC/runtime restringido------> PostgreSQL DW (5432)
                                                   ^
                                                   |
 OLAP/Saiku (8080) --JDBC/solo lectura------------+
```

Los nombres de host mostrados a una aplicación deben resolverse desde la red donde corre ese contenedor. Si UATF usa bases administradas fuera de Docker, reemplazar los nombres por sus DNS privados y abrir únicamente los puertos necesarios desde las redes de aplicaciones.

| Conexión | Quién inicia | Destino | Uso |
|---|---|---|---|
| OIDC issuer | auth-service, OLAP y clientes web | URL HTTPS pública estable de Keycloak, realm `uatf-dss-realm` | El `iss` del token debe coincidir exactamente con esta URL. |
| JWKS | auth-service y OLAP | Endpoint de claves accesible desde la red privada | Descargar las claves para verificar JWT. Puede ser el DNS interno de Keycloak. |
| IAM JDBC | auth-service | PostgreSQL IAM, base `dss_identity` | Flyway ejecuta las migraciones `V1` a `V5` al iniciar auth-service. |
| Keycloak JDBC | Keycloak | PostgreSQL IAM, esquema `keycloak` | Almacena realms, usuarios, clientes y sesiones. Usa un rol distinto al de auth-service. |
| AMQP | Keycloak provider y auth-service | RabbitMQ, puerto `5672`, vhost `/` | Keycloak publica eventos de usuarios; auth-service consume la cola durable `keycloak.user.events`. |
| DW JDBC | OLAP | PostgreSQL DW, esquema `dw` | Lectura de cubos OLAP con usuario de solo lectura. |
| DW JDBC | Apache Hop | PostgreSQL DW, esquemas de staging/control/publicación | ETL con la cuenta `dw_hop_runtime` y permisos otorgados por las migraciones. |
| OLTP JDBC | Apache Hop | Base transaccional Jachasun | Extracción; entregar cuenta de solo lectura. |
| Catálogo JDBC | Apache Hop | Base IAM/Auth Service | Sincronización del catálogo académico; cuenta dedicada de privilegio mínimo. |

## 3. Requisitos que UATF debe provisionar

1. Host Linux soportado por Docker Engine y Docker Compose v2, con almacenamiento persistente, DNS interno, sincronización horaria, monitoreo y capacidad suficiente para JVM, PostgreSQL y RabbitMQ.
2. Un proxy inverso institucional con TLS válido para Keycloak y los portales. Hop Web no debe publicarse a Internet; limitarlo a VPN/red administrativa y agregar autenticación/autorización en el proxy.
3. Dos bases PostgreSQL 15 o equivalentes administradas y respaldadas:
   - IAM: base `dss_identity`, usada por Keycloak y auth-service con roles/esquemas separados.
   - DW: base que ejecutará las migraciones de `infra/dw-schema/migrations`.
4. Una instancia RabbitMQ 4.x privada, persistente y respaldada; en producción es preferible separar las cuentas de publicador y consumidor y limitar permisos por vhost/cola.
5. Acceso desde Hop a Jachasun y al catálogo de identidad. Confirmar DNS, firewall, TLS/certificados JDBC cuando corresponda y cuentas dedicadas.
6. Secret store aprobado por UATF para contraseñas y secretos. No enviar secretos por correo, chat, tickets públicos ni archivos versionados.
7. Paquete de despliegue de la misma versión de Git que produjo las imágenes: migraciones DW/scripts, descriptor y esquema OLAP, realm Keycloak revisado, y plantillas de Hop. Las imágenes no incluyen todos esos artefactos operativos.

### 3.1 Decisiones de producción pendientes

Completar con UATF antes de producir los archivos de runtime:

- URL pública de Keycloak y DNS internos de cada servicio/base.
- Dominios y orígenes HTTPS de cada portal para CORS y redirect URIs OAuth.
- Si PostgreSQL IAM y DW serán administrados por UATF o ejecutados en contenedores, estrategia de backup/restore y responsable DBA.
- Identidad y contraseña de cada rol: migrador, auth runtime, Keycloak, `dw_hop_runtime`, `dw_reader`, OLTP read-only, catálogo Hop y RabbitMQ.
- Ubicación segura de `prod-env.json` de Hop y política de acceso a Hop Web.
- Política de exposición de API OLAP y auth-service; puertos internos, proxy y reglas de firewall.

## 4. Obtener las imágenes

Las imágenes son públicas según la configuración del pipeline. Si Docker Hub las cambia a privadas, hacer `docker login` con un token de solo lectura emitido para el servidor UATF; nunca usar el token de publicación CI.

```bash
docker pull kevin117rodriguez/dss-auth-service:1.0.0
docker pull kevin117rodriguez/dss-keycloak:1.0.0
docker pull kevin117rodriguez/dss-olap-service:1.0.0
docker pull kevin117rodriguez/dss-apache-hop:1.0.0
```

Registrar los digests descargados para la bitácora de instalación:

```bash
docker image inspect \
  kevin117rodriguez/dss-auth-service:1.0.0 \
  kevin117rodriguez/dss-keycloak:1.0.0 \
  kevin117rodriguez/dss-olap-service:1.0.0 \
  kevin117rodriguez/dss-apache-hop:1.0.0 \
  --format '{{.RepoTags}} {{.RepoDigests}}'
```

Para producción, anotar el digest (`@sha256:...`) asociado a cada tag en el manifiesto del despliegue y considerar fijar los servicios a ese digest. Los tags semver `1.0.0` se deben usar para la primera instalación; `latest`, `1` y `1.0` son conveniencias mutables, no la referencia de auditoría.

## 5. Variables por componente

Los valores entre `<...>` son marcadores que deben sustituirse por valores aprobados; no copiarlos literalmente. Los secretos se inyectan desde el secret store/orquestador y no deben quedar en Git ni en logs.

### 5.1 PostgreSQL IAM y Keycloak

Provisionar la base `dss_identity`, el esquema Keycloak y dos usuarios independientes:

- `AUTH_DB_USER`, `AUTH_DB_PASSWORD`: dueño/migrador de auth-service según el esquema de permisos aprobado. Flyway inicia al arrancar auth-service. `ddl-auto` está en `validate`, por lo que la base debe tener el esquema esperado y el servicio no crea las tablas con Hibernate.
- `KC_DB_USERNAME`, `KC_DB_PASSWORD`: usuario limitado al esquema `keycloak`.
- `AUTH_DB_NAME=dss_identity`.

Si se usa `infra/keycloak/init-db.sql` para crear el esquema, revisarlo antes: el script fuente trae una contraseña de ejemplo codificada (`change-in-production`). No ejecutar sin sustituirla por provisionamiento seguro. En producción se recomienda que el DBA cree el rol y esquema con la contraseña secreta fuera del script y permisos mínimos.

Variables de conexión que debe recibir auth-service:

```dotenv
SPRING_PROFILE_ACTIVE=prod
SERVER_PORT=8080
DB_URI=jdbc:postgresql://<IAM_DB_HOST>:5432/dss_identity
DB_USERNAME=<AUTH_DB_USER>
DB_PASSWORD=<AUTH_DB_PASSWORD>
```

Keycloak recibe una configuración equivalente por las opciones runtime `--db=postgres`, `--db-url=jdbc:postgresql://<IAM_DB_HOST>:5432/dss_identity`, `--db-schema=keycloak`, `--db-username=<KC_DB_USERNAME>` y `--db-password=<KC_DB_PASSWORD>`; también necesita `KC_BOOTSTRAP_ADMIN_USERNAME` y `KC_BOOTSTRAP_ADMIN_PASSWORD` para el administrador bootstrap.

### 5.2 Keycloak / OIDC

Variables/valores de runtime importantes:

```dotenv
KC_BOOTSTRAP_ADMIN_USERNAME=<ADMIN_BOOTSTRAP>
KC_BOOTSTRAP_ADMIN_PASSWORD=<SECRET>
KEYCLOAK_BFF_CLIENT_SECRET=<SECRET_DEL_CLIENT_CONFIDENCIAL_DSS_BFF>
```

En el proceso Keycloak, usar el comando de producción `start --optimized --import-realm` y configurar:

```text
--hostname=https://<KEYCLOAK_PUBLIC_HOST>
--hostname-strict=true
--proxy-headers=xforwarded
--http-enabled=true                 # TLS termina en el proxy institucional
--health-enabled=true
--metrics-enabled=true
--db=postgres
--db-url=jdbc:postgresql://<IAM_DB_HOST>:5432/dss_identity
--db-schema=keycloak
--db-username=<KC_DB_USERNAME>
--db-password=<KC_DB_PASSWORD>
```

El proxy debe enviar `Forwarded`/`X-Forwarded-*` según la política de Keycloak y no aceptar esos headers de clientes directos. Si UATF requiere TLS también entre proxy y contenedor, ajustar `--http-enabled` y certificados según el diseño de seguridad. No usar `start-dev` en UATF.

Antes de importar el realm, revisar `infra/keycloak/realm/uatf-dss-realm-realm.json`: issuer, URL base, redirect URIs y web origins para los dominios definitivos; secreto de `dss-bff` y configuración de clientes que apliquen. `KEYCLOAK_BFF_CLIENT_SECRET` debe coincidir con el secreto que recibe el BFF. El realm inicial se importa con `--import-realm`; actualizar configuración del realm ya existente es un procedimiento de migración aparte y no debe asumirse que el import lo sobrescribe.

Valores que auth-service debe recibir (reemplazar host/realm según el realm aprobado):

```dotenv
KEYCLOAK_ISSUER_URI=https://<KEYCLOAK_PUBLIC_HOST>/realms/uatf-dss-realm
KEYCLOAK_JWK_SET_URI=http://keycloak:8080/realms/uatf-dss-realm/protocol/openid-connect/certs
KEYCLOAK_RESOURCE_ID=uatf-auth-service
KEYCLOAK_AUDIENCE=uatf-auth-service
KEYCLOAK_PRINCIPAL_ATTRIBUTE=preferred_username
AUTH_CORS_ALLOWED_ORIGINS=https://<PORTAL_1>,https://<PORTAL_2>
```

El issuer dentro de los JWT y `KEYCLOAK_ISSUER_URI` tienen que coincidir byte por byte (incluido esquema, host, puerto si aplica y path). El JWKS debe ser alcanzable desde el contenedor. Para OLAP, usar el mismo issuer y el audience/client configurado en Keycloak (`olap-service`).

### 5.3 RabbitMQ

Usar una cuenta administrada para la inicialización o el usuario/clave de un servicio RabbitMQ gestionado:

```dotenv
RABBITMQ_HOST=<RABBITMQ_DNS_PRIVADO>
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=<USUARIO_SERVICIO>
RABBITMQ_PASSWORD=<SECRETO>
RABBITMQ_VHOST=/
```

El contenedor de Keycloak necesita estas variables para su provider: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`. Auth-service necesita el mismo endpoint y credencial consumidora. No utilizar el puerto de administración `15672` como puerto AMQP. Mantener persistencia de RabbitMQ y monitorear la cola durable `keycloak.user.events` y su DLQ.

### 5.4 Auth Service

Además de DB y OIDC, configurar:

```dotenv
RABBITMQ_HOST=<RABBITMQ_DNS_PRIVADO>
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=<USUARIO_AUTH_SERVICE>
RABBITMQ_PASSWORD=<SECRETO>
RABBITMQ_VHOST=/
AUTH_CORS_ALLOWED_ORIGINS=https://<ORIGENES_DE_PORTALES_SEPARADOS_POR_COMA>
AUTH_API_DOCS_ENABLED=false
```

El perfil `prod` deshabilita Swagger por defecto y requiere orígenes HTTPS. Publicar el endpoint detrás del proxy institucional; el contexto HTTP es `/api/v1` y el puerto interno configurable es `SERVER_PORT` (usar `8080` dentro de la red). Health/info/metrics se exponen por Spring Actuator; limitar los detalles y métricas al acceso interno.

**Migraciones:** Flyway empacado en auth-service ejecuta `auth-service/src/main/resources/db/migration/V1__...sql` a `V5__...sql` al iniciar. Respaldar la base primero. El usuario de conexión debe tener permiso para crear/alterar las tablas iniciales de la aplicación. `ddl-auto=validate` comprueba el modelo; no sustituye las migraciones.

### 5.5 Data Warehouse y migrador

Variables del PostgreSQL DW:

```dotenv
POSTGRES_DW_HOST=<DW_DNS_PRIVADO>
POSTGRES_DW_PORT=5432
POSTGRES_DW_NAME=<NOMBRE_BASE_DW>
POSTGRES_DW_USER=<USUARIO_MIGRADOR_DW>
POSTGRES_DW_PASSWORD=<SECRETO>
```

Aplicar las migraciones versionadas incluidas en la imagen `dss-dw-migrator:<versión>` con el runner `infra/dw-schema/scripts/apply-migrations.sh`. El pipeline CI construye la imagen para validar que incluya el runner y los SQL; Release Please la publica en Docker Hub con tags versionados. En Dokploy, ejecutar explícitamente el contenedor como tarea temporal dentro de la red privada del DW, suministrando `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD` como variables/secretos de runtime. Publicar la imagen no ejecuta las migraciones y no se requiere un volumen persistente. El runner registra checksums en `etl_control.schema_migration` y falla ante una discrepancia; no montar el checkout de un desarrollador en producción.

Ejecutar migraciones con cuenta DBA/migrador controlada y revisar permisos/compatibilidad; no usar `POSTGRES_DW_USER` como usuario diario de Hop ni OLAP. Las migraciones crean estructuras/roles como `dw_reader` y `dw_hop_runtime`, pero la administración de credenciales LOGIN y contraseñas de roles debe completarse de forma segura por DBA, según el procedimiento aprobado.

Antes de cambiar de versión, backup del DW, revisar el diff de migraciones y ejecutar el mismo conjunto en staging. El migrador falla si detecta checksum diferente para una migración ya aplicada; no editar ni volver a numerar migraciones aplicadas.

### 5.6 Apache Hop

La imagen incluye Apache Hop Web 2.19.0, el proyecto `dss-uatf-etl`, el wrapper y el driver PostgreSQL. La imagen no incluye el archivo de ambiente productivo con credenciales.

En un directorio protegido de despliegue, crear `prod-env.json` a partir de `etl-layer/apache-hop/projects/dss-uatf-etl/environments/prod-env.example.json`, completar todos los valores de conexión JDBC y montarlo solo lectura en:

```text
/files/project/environments/prod-env.json
```

Variables del proceso:

```dotenv
HOP_PROJECT_NAME=dss-uatf-etl
HOP_PROJECT_FOLDER=/files/project
HOP_PROJECT_CONFIG_FILE_NAME=project-config.json
HOP_ENVIRONMENT_NAME=prod
HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS=/files/project/environments/prod-env.json
HOP_ADDITIONAL_ENVIRONMENT_NAMES=
HOP_SHARED_JDBC_FOLDERS=/files
```

El wrapper falla al iniciar si el JSON seleccionado no existe. No incluir `dev`/`test` como ambientes adicionales de una instancia productiva. En el JSON configurar estos tres grupos; las URLs JDBC deben corresponder a host, puerto y base:

| Grupo | Variables requeridas | Propósito |
|---|---|---|
| DW | `DSS_DW_HOSTNAME`, `DSS_DW_PORT`, `DSS_DW_DATABASE`, `DSS_DW_USERNAME`, `DSS_DW_PASSWORD`, `DSS_DW_URL` | Usuario `dw_hop_runtime` para funciones controladas de carga/publicación. |
| OLTP | `OLTP_DB_HOSTNAME`, `OLTP_DB_PORT`, `OLTP_DB_DATABASE`, `OLTP_DB_USERNAME`, `OLTP_DB_PASSWORD`, `OLTP_DB_URL` | Cuenta de solo lectura sobre Jachasun. |
| Catálogo Auth | `AUTH_CATALOG_DB_HOSTNAME`, `AUTH_CATALOG_DB_PORT`, `AUTH_CATALOG_DB_DATABASE`, `AUTH_CATALOG_DB_USERNAME`, `AUTH_CATALOG_DB_PASSWORD`, `AUTH_CATALOG_DB_URL` | Cuenta de mínimo privilegio para leer/sincronizar el catálogo académico. |

Permisos del archivo del host: dueño del servicio, modo `0600`; volumen `:ro`. No guardar contraseña dentro de la imagen ni en argumentos de línea de comando. Proteger Hop Web con proxy autenticado y restringir su acceso a administradores ETL autorizados: Hop Web puede editar y ejecutar pipelines. No exponer el puerto 8080 directamente a redes públicas.

El volumen del proyecto en el Compose local existe para desarrollo y permite modificar archivos; para producción el proyecto está empaquetado en la imagen. Montar solo el archivo de ambiente y cualquier estado requerido de forma explícita, no reemplazar todo `/files/project` accidentalmente.

### 5.7 OLAP / Saiku

Variables principales:

```dotenv
SAIKU_HOME=/app/saiku-home
SAIKU_DEMO=false
SAIKU_AI_POLICY=aggregated
SAIKU_AI_KANONYMITY=5
SAIKU_ADMIN_PASSWORD=<CONTRASEÑA_FUERTE_UNICA>
KEYCLOAK_ISSUER_URI=https://<KEYCLOAK_PUBLIC_HOST>/realms/uatf-dss-realm
KEYCLOAK_JWK_SET_URI=http://keycloak:8080/realms/uatf-dss-realm/protocol/openid-connect/certs
KEYCLOAK_OLAP_AUDIENCE=olap-service
KEYCLOAK_OLAP_CLIENT_ID=olap-service
```

El password del admin se inicializa en el `saiku-home` y se guarda como hash. Mantener persistente y respaldado `/app/saiku-home`; no borrar el volumen al actualizar. El contenedor corre como usuario no-root `10001:10001`; volúmenes bind montados deben permitir escritura a esa identidad.

El primer arranque requiere ejecutar el inicializador `docker/initialize-academic-olap.sh` de la versión correspondiente, con los archivos `infra/olap/datasources/uatf-dw.sds` y `infra/olap/schemas/uatf-rendimiento-academico.xml` montados en sus rutas esperadas. El inicializador escribe descriptor, esquema y `datasources.properties` (modo privado) en el volumen de Saiku. El script local espera `OLAP_DB_USER`, `OLAP_DB_PASSWORD` y `OLAP_DB_NAME`; se recomienda el usuario `dw_olap_runtime` de solo lectura y contraseña hexadecimal según validación del script. La inicialización no crea ni carga datos en el DW: primero deben aplicarse migraciones y ejecutar ETL autorizado.

Proteger el endpoint de OLAP tras el proxy, validar audience/roles con el realm importado y no exponer el puerto 8080 del contenedor a Internet. Mantener `SAIKU_DEMO=false` para no cargar datos de ejemplo.

## 6. Secuencia recomendada de instalación

1. **Preparación:** UATF confirma hosts, dominios, red, proxy/TLS, cuentas, ventanas, backup y responsables. Aprovisionar los secret values y bases. No iniciar hasta reemplazar todos los marcadores `REPLACE_WITH_...`.
2. **Descarga/verificación:** ejecutar los `docker pull` de `1.0.0`; registrar tag, digest, fecha, arquitectura y release de GitHub.
3. **PostgreSQL IAM:** crear la base, usuarios y esquema `keycloak` de forma segura; confirmar conectividad desde la red de contenedores. Aplicar primero en staging.
4. **RabbitMQ:** crear vhost, cuentas, permisos, persistencia y health monitoring.
5. **Keycloak:** configurar hostname público y TLS en el proxy; arrancar con `start --optimized --import-realm` y PostgreSQL. Verificar `/health/ready` desde la red autorizada y el documento discovery del realm. Revisar clients, redirects y secretos.
6. **Auth-service:** inyectar `prod`, JDBC, issuer/JWKS, audience, CORS y RabbitMQ. Arrancar; validar que Flyway termine y que el health endpoint esté disponible antes de conectar clientes.
7. **DW:** tomar backup, ejecutar `0001`–`0020` con la cuenta migradora, comprobar `etl_control.schema_migration`, los roles y grants. Configurar secretos runtime separados para OLAP y Hop.
8. **OLAP:** provisionar volumen persistente, ejecutar inicialización del catálogo de la misma versión, arrancar servicio y revisar healthcheck, login y conectividad JDBC de solo lectura.
9. **Apache Hop:** crear y proteger `prod-env.json`, montar en ruta exacta, arrancar en red privada/VPN con ambiente `prod`, verificar que el proyecto y ambiente estén seleccionados. Hacer smoke test solo en una fuente/ventana autorizada y nunca ejecutar cargas productivas sin aprobación de datos.
10. **Validación integral:** probar login OIDC, consumo de eventos de usuario, API auth, conexión Saiku→DW, ejecución ETL de prueba controlada, backup/restore, reinicio y observabilidad. Registrar versiones/digests y configuración efectiva sin secretos.

Los servicios de aplicación deben arrancar después de sus dependencias saludables. En Compose se representa con `depends_on: condition: service_healthy` para servicios con healthcheck y `service_completed_successfully` para tareas migradoras/inicializadoras. En Kubernetes u otro orquestador, expresar lo mismo con readiness probes y Jobs de migración, no con pausas fijas de tiempo.

## 7. Verificación operativa

Ejecutar en el servidor, desde la red administrativa. Los puertos son internos y deben probarse según la publicación que haya aprobado UATF:

```bash
docker image ls | grep 'kevin117rodriguez/dss-'
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker logs --tail=200 <CONTENEDOR>
```

Comprobaciones de servicio:

- Keycloak listo: `GET http://keycloak:9000/health/ready` desde la red interna (exponer puerto 9000 solo a monitoreo si el diseño lo permite).
- Keycloak realm: `GET https://<KEYCLOAK_PUBLIC_HOST>/realms/uatf-dss-realm/.well-known/openid-configuration` desde un cliente autorizado; revisar `issuer`.
- Auth-service: health Actuator en la ruta `/api/v1/actuator/health` según el context path desplegado; confirmar status sin mostrar detalles a usuarios no autorizados.
- OLAP: su healthcheck de imagen consulta `HEAD /rest/saiku/info` en puerto 8080 interno.
- Hop: comprobar que el log no indique `Required Hop environment config is missing`, que `dss-uatf-etl` y `prod` sean el proyecto/ambiente activos y que la UI solo responda desde la red administrativa.
- RabbitMQ: comprobar el healthcheck del broker, la cola `keycloak.user.events`, consumidores, mensajes pendientes y DLQ.
- DW: verificar la tabla de control de migraciones, conectividad de `dw_reader`/`dw_hop_runtime` y permisos negativos (cuentas de lectura no deben escribir; OLTP Hop no debe escribir).

No ejecutar `docker compose config`, `docker inspect` con salida completa, `env` ni comandos de dump de configuración en una sesión/log compartido: pueden mostrar contraseñas. No colocar secretos en el texto de evidencia de despliegue.

## 8. Actualización y rollback

1. Leer release notes y seleccionar una versión semver explícita para cada imagen. El versionado es independiente por componente; desplegar una nueva versión de un componente no implica actualizar los otros.
2. Revisar cambios de configuración y migraciones antes de actualizar; respaldar IAM, DW, volúmenes persistentes de RabbitMQ y `/app/saiku-home`.
3. Descargar la imagen nueva y registrar su digest. Probar en staging con un restore representativo.
4. Aplicar migraciones compatibles de forma controlada antes de enrutar tráfico a una versión que las requiera.
5. Actualizar un servicio por vez, comprobar health y logs, luego validar el flujo funcional completo.
6. Rollback de imagen solo si la migración es compatible hacia atrás. No restaurar datos/volúmenes desde versiones distintas sin seguir el procedimiento del DBA y las notas de release.

No borrar volúmenes al hacer rollback. El tag `latest` puede cambiar de contenido; una auditoría debe identificar los digests efectivamente ejecutados.

## 9. Referencias de esta versión

- Repositorios Docker Hub: [auth-service](https://hub.docker.com/r/kevin117rodriguez/dss-auth-service), [Keycloak](https://hub.docker.com/r/kevin117rodriguez/dss-keycloak), [OLAP service](https://hub.docker.com/r/kevin117rodriguez/dss-olap-service), [Apache Hop](https://hub.docker.com/r/kevin117rodriguez/dss-apache-hop).
- [Releases de GitHub](https://github.com/KEVIN-117/dss-system-architecture/releases).
- Fuentes de configuración del repositorio: `docker-compose.yml`, `.env.example`, `docs/envs/*.md`, `infra/dw-schema/migrations`, `infra/keycloak/realm`, `infra/olap`, `auth-service/src/main/resources/db/migration` y `etl-layer/apache-hop/projects/dss-uatf-etl/environments`.
