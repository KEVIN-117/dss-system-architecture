# **Documentación de Contenedores y Variables de Entorno para Apache Hop en Docker**

La idea principal es que la imagen `apache/hop` funciona en dos modelos:

* Short-lived container: levanta el contenedor, ejecuta un pipeline/workflow y termina.
* Long-lived container: levanta un Hop Server y queda esperando trabajos.

Además, la imagen utiliza Alpine Linux, OpenJDK 21 y ejecuta Hop con el usuario Linux `hop`. La instalación está en `/opt/hop`, mientras que `/files` está pensado como volumen para proyectos, configuraciones, pipelines y workflows. ([Apache Hop][1])

### 1. Modelo mental de las ENVs

Es útil dividir las variables en cinco grupos:

```text
                         Apache Hop Docker
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
          Proyecto          Ejecución          Servidor
              │                 │                 │
     HOP_PROJECT_*       HOP_FILE_PATH      HOP_SERVER_*
     HOP_ENVIRONMENT_*   HOP_RUN_*          
              │
              └───────────────┐
                              │
                    Configuración avanzada
                              │
             HOP_OPTIONS / HOP_SYSTEM_PROPERTIES
             HOP_CONFIG_OPTIONS / HOP_COMMAND_*
             HOP_SHARED_JDBC_FOLDERS
```

Esto es importante porque no todas las ENVs se utilizan al mismo tiempo.

### 2. ENVs fundamentales para un proyecto

Las variables que probablemente utilizarás más en un despliegue real son estas:

| ENV                                      | Importancia | Función                                |
| ---------------------------------------- | ----------- | -------------------------------------- |
| `HOP_PROJECT_NAME`                       | Alta        | Nombre del proyecto Hop                |
| `HOP_PROJECT_FOLDER`                     | Alta        | Directorio raíz del proyecto           |
| `HOP_PROJECT_CONFIG_FILE_NAME`           | Media       | Nombre del `project-config.json`       |
| `HOP_ENVIRONMENT_NAME`                   | Alta        | Ambiente Hop que se registra           |
| `HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS` | Alta        | Archivos de configuración del ambiente |
| `HOP_PARENT_PROJECT_NAME`                | Media       | Proyecto padre, si existe              |
| `HOP_PARENT_PROJECT_FOLDER`              | Media       | Directorio del proyecto padre          |

`HOP_PROJECT_NAME` y `HOP_PROJECT_FOLDER` forman prácticamente la pareja básica para registrar un proyecto dentro del contenedor. Si no defines `HOP_PROJECT_NAME`, el entrypoint no crea el proyecto ni el environment asociado. ([Apache Hop][1])

Por ejemplo:

```yaml
environment:
  HOP_PROJECT_NAME: university-data-platform
  HOP_PROJECT_FOLDER: /files/project
  HOP_PROJECT_CONFIG_FILE_NAME: project-config.json

  HOP_ENVIRONMENT_NAME: production
  HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS: /files/config/production.json
```

La relación sería:

```text
/files
│
├── project/
│   ├── project-config.json
│   ├── pipelines/
│   └── workflows/
│
└── config/
    └── production.json
```

### 3. Ejecución de pipelines y workflows

Para un contenedor short-lived, las dos variables esenciales son:

```text
HOP_FILE_PATH
HOP_RUN_CONFIG
```

`HOP_FILE_PATH` indica qué pipeline `.hpl` o workflow `.hwf` ejecutar.

`HOP_RUN_CONFIG` indica qué Run Configuration utilizar.

La documentación marca ambas como obligatorias para el modo short-lived. ([Apache Hop][1])

Por ejemplo:

```yaml
environment:
  HOP_FILE_PATH: ${PROJECT_HOME}/workflows/main.hwf
  HOP_RUN_CONFIG: local
```

Aquí aparece una idea importante de Hop:

```text
HOP_PROJECT_FOLDER
        │
        ▼
   PROJECT_HOME
        │
        ▼
${PROJECT_HOME}/workflows/main.hwf
```

Por eso puedes evitar hardcodear rutas completas dentro de `HOP_FILE_PATH`.

También tienes:

```text
HOP_RUN_PARAMETERS
```

para enviar parámetros al pipeline/workflow:

```yaml
HOP_RUN_PARAMETERS: PARAM_ENV=production,PARAM_DATE=2026-08-18
```

La documentación especifica que estos parámetros se expresan como una lista separada por comas. ([Apache Hop][1])

### 4. Variables de configuración del Environment

Estas son especialmente importantes si quieres tener:

```text
development
testing
production
```

sin modificar tus pipelines.

La combinación es:

```text
HOP_ENVIRONMENT_NAME
HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS
```

Por ejemplo:

```yaml
HOP_ENVIRONMENT_NAME: production
HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS: /files/config/production.json
```

Esto permite separar:

```text
Pipeline/Workflow
      │
      ├── lógica
      │
      └── configuración
              │
              ├── dev
              ├── test
              └── production
```

Es una de las partes que considero más importantes de la imagen Docker para una arquitectura de datos, porque permite mantener el artefacto del pipeline relativamente independiente de la configuración específica del ambiente.

### 5. Logging

Hay dos variables importantes:

```text
HOP_LOG_LEVEL
HOP_LOG_PATH
```

`HOP_LOG_LEVEL` tiene como default:

```text
Basic
```

y soporta:

```text
None
Error
Minimal
Basic
Detailed
Debug
Rowlevel
```

`HOP_LOG_PATH` apunta por defecto a:

```text
/opt/hop/hop.err.log
```

([Apache Hop][1])

Para producción normalmente evitaría `Debug` o `Rowlevel` salvo que estés investigando un problema, porque pueden producir bastante volumen de logs.

Por ejemplo:

```yaml
environment:
  HOP_LOG_LEVEL: Basic
```

### 6. JVM y memoria

Una ENV particularmente importante es:

```text
HOP_OPTIONS
```

Por defecto:

```text
-XX:+AggressiveHeap
```

La documentación indica que esta opción hace que el contenedor utilice toda la memoria que tenga asignada. ([Apache Hop][1])

Puedes utilizarla para introducir opciones de JVM, por ejemplo:

```yaml
environment:
  HOP_OPTIONS: "-Xms512m -Xmx2g"
```

Esto es especialmente relevante en Kubernetes/Docker porque existe una relación:

```text
Docker/Kubernetes memory limit
            │
            ▼
       JVM Heap
            │
            ▼
     Apache Hop
```

Por tanto, en producción conviene pensar conjuntamente en los límites del contenedor y la configuración de la JVM.

### 7. JDBC

Para una plataforma de datos, estas variables son muy interesantes:

```text
HOP_SHARED_JDBC_FOLDERS
HOP_DRIVERS_DOWNLOAD
HOP_DRIVERS_ACCEPT_LICENSE
HOP_DRIVERS_MAVEN_REPO
```

La documentación actual añade soporte para descargar drivers JDBC durante el arranque. `HOP_DRIVERS_DOWNLOAD` recibe una lista de IDs de drivers, opcionalmente con versión. `HOP_DRIVERS_ACCEPT_LICENSE=true` permite aceptar las licencias de drivers restringidos, y `HOP_DRIVERS_MAVEN_REPO` permite utilizar un repositorio Maven alternativo, como Nexus o Artifactory. ([Apache Hop][1])

Por ejemplo:

```yaml
environment:
  HOP_SHARED_JDBC_FOLDERS: /files/jdbc
  HOP_DRIVERS_DOWNLOAD: postgresql,mysql
```

Para un entorno empresarial incluso podrías pensar en:

```text
                   Nexus / Artifactory
                           │
                           ▼
                    JDBC Drivers
                           │
                           ▼
                    Apache Hop
```

Esto resulta particularmente interesante para entornos aislados de Internet.

### 8. HOP_CONFIG_OPTIONS

Esta variable permite ejecutar opciones de `hop-conf.sh` antes de ejecutar el contenedor short-lived o long-lived. La documentación menciona, por ejemplo, configuraciones relacionadas con claves y plugins. ([Apache Hop][1])

Conceptualmente:

```text
Docker start
     │
     ▼
HOP_CONFIG_OPTIONS
     │
     ▼
hop-conf.sh
     │
     ▼
Apache Hop
```

No la consideraría una ENV cotidiana; es más bien una herramienta de configuración avanzada.

### 9. HOP_SYSTEM_PROPERTIES

Permite establecer Java system properties:

```yaml
environment:
  HOP_SYSTEM_PROPERTIES: "PROP1=value1,PROP2=value2"
```

Esto es útil cuando una configuración necesita llegar a Hop como propiedad del sistema Java.

La diferencia conceptual sería:

```text
HOP_RUN_PARAMETERS
        │
        ▼
 parámetros del pipeline/workflow


HOP_SYSTEM_PROPERTIES
        │
        ▼
 propiedades del sistema Java/Hop
```

No conviene confundirlas.

### 10. Custom Entrypoint

Una de las variables más interesantes para DevOps es:

```text
HOP_CUSTOM_ENTRYPOINT_EXTENSION_SHELL_FILE_PATH
```

Permite ejecutar un script personalizado durante el arranque. La propia documentación da como ejemplo utilizarlo para recuperar proyectos desde S3 o GitLab. ([Apache Hop][1])

Por ejemplo:

```yaml
environment:
  HOP_CUSTOM_ENTRYPOINT_EXTENSION_SHELL_FILE_PATH: /home/hop/clone-project.sh
```

Esto permite construir un flujo como:

```text
Container Start
      │
      ▼
Custom Entrypoint
      │
      ├── git clone
      ├── descargar S3
      ├── preparar archivos
      └── preparar configuración
      │
      ▼
Apache Hop
      │
      ▼
Pipeline / Workflow
```

Para CI/CD puede ser bastante útil.

---

## 11. Variables específicas de Hop Server

Cuando utilizas un contenedor long-lived, entran las `HOP_SERVER_*`.

Las principales son:

```text
HOP_SERVER_HOSTNAME
HOP_SERVER_PORT
HOP_SERVER_AUTH
HOP_SERVER_USER
HOP_SERVER_PASS
```

Por defecto:

```text
HOP_SERVER_HOSTNAME = 0.0.0.0
HOP_SERVER_PORT     = 8080
HOP_SERVER_AUTH     = true
HOP_SERVER_USER     = cluster
HOP_SERVER_PASS     = cluster
```

([Apache Hop][1])

Una configuración básica sería:

```yaml
environment:
  HOP_SERVER_HOSTNAME: 0.0.0.0
  HOP_SERVER_PORT: 8080
  HOP_SERVER_AUTH: "true"
  HOP_SERVER_USER: admin
  HOP_SERVER_PASS: ${HOP_SERVER_PASSWORD}
```

En producción, obviamente no pondría una contraseña directamente en el `docker-compose.yml`; utilizaría secrets/secret manager.

### 12. Shutdown

La versión actual de la documentación también tiene:

```text
HOP_SERVER_SHUTDOWN_TIMEOUT
```

Su default es:

```text
0
```

y representa el máximo de segundos que Hop espera para que terminen pipelines/workflows activos antes de apagar el servidor. Con `0`, el apagado es inmediato. ([Apache Hop][1])

Esto es bastante importante cuando ejecutas Hop Server bajo Docker/Kubernetes:

```text
SIGTERM
   │
   ▼
HOP_SERVER_SHUTDOWN_TIMEOUT
   │
   ├── espera trabajos
   │
   └── shutdown
```

Si tienes pipelines largos, yo revisaría esta variable antes de desplegar el servidor en Kubernetes.

### 13. Gestión de logs y objetos en Hop Server

Hay tres variables:

```text
HOP_SERVER_MAX_LOG_LINES
HOP_SERVER_MAX_LOG_TIMEOUT
HOP_SERVER_MAX_OBJECT_TIMEOUT
```

Sus defaults actuales son:

```text
HOP_SERVER_MAX_LOG_LINES       = 0
HOP_SERVER_MAX_LOG_TIMEOUT     = 0
HOP_SERVER_MAX_OBJECT_TIMEOUT  = 1440
```

Es decir:

```text
MAX_LOG_LINES = 0
        ↓
mantener todos los logs en memoria

MAX_LOG_TIMEOUT = 0
        ↓
no limpiar logs automáticamente

MAX_OBJECT_TIMEOUT = 1440
        ↓
24 horas
```

([Apache Hop][1])

En servidores con muchas ejecuciones, esto merece especial atención porque `0` significa que los logs pueden permanecer en memoria indefinidamente.

### 14. Metadata del servidor

```text
HOP_SERVER_METADATA_FOLDER
```

permite especificar un directorio con archivos JSON de metadata que estarán disponibles para Hop Server. La documentación también indica que esta variable es necesaria para utilizar correctamente la funcionalidad de web services del servidor. ([Apache Hop][1])

Por ejemplo:

```yaml
environment:
  HOP_SERVER_METADATA_FOLDER: /files/metadata
```

y:

```text
/files
├── metadata/
├── project/
└── config/
```

### 15. HTTPS / SSL

Para SSL tienes:

```text
HOP_SERVER_KEYSTORE
HOP_SERVER_KEYSTORE_PASSWORD
HOP_SERVER_KEY_PASSWORD
```

Conceptualmente:

```text
HOP_SERVER_KEYSTORE
        │
        ▼
Java Keystore
        │
        ├── certificate
        └── private key
```

Las contraseñas permiten desbloquear el keystore y la clave. Si ambas contraseñas son iguales, la documentación indica que `HOP_SERVER_KEY_PASSWORD` puede omitirse. ([Apache Hop][1])

---

## 16. Mapeo que yo utilizaría para Docker Compose

Si estás pensando en una arquitectura de datos, este sería un buen punto de partida:

```yaml
services:

  hop:
    image: apache/hop:<version>

    environment:

      # ─────────────────────────────
      # Project
      # ─────────────────────────────
      HOP_PROJECT_NAME: university-data-platform
      HOP_PROJECT_FOLDER: /files/project

      # ─────────────────────────────
      # Environment
      # ─────────────────────────────
      HOP_ENVIRONMENT_NAME: production
      HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS: /files/config/production.json

      # ─────────────────────────────
      # Execution
      # ─────────────────────────────
      HOP_FILE_PATH: ${PROJECT_HOME}/workflows/main.hwf
      HOP_RUN_CONFIG: local
      HOP_RUN_PARAMETERS: "PARAM_ENV=production"

      # ─────────────────────────────
      # Logging
      # ─────────────────────────────
      HOP_LOG_LEVEL: Basic

      # ─────────────────────────────
      # JVM
      # ─────────────────────────────
      HOP_OPTIONS: "-Xms512m -Xmx2g"

      # ─────────────────────────────
      # JDBC
      # ─────────────────────────────
      HOP_SHARED_JDBC_FOLDERS: /files/jdbc

    volumes:
      - ./hop:/files
```

La separación resultante sería:

```text
                    Docker
                      │
                      ▼
                Apache Hop
                      │
       ┌──────────────┼──────────────┐
       │              │              │
    Project       Environment     Runtime
       │              │              │
       ▼              ▼              ▼
 /files/project  production.json  HOP_RUN_*
       │
       ├── pipelines/
       ├── workflows/
       └── project-config.json
```

---

## 17. Mi clasificación de importancia

Si estás construyendo una plataforma seria de datos con Apache Hop, yo priorizaría las variables así:

**Nivel 1 — imprescindibles**

```text
HOP_PROJECT_NAME
HOP_PROJECT_FOLDER
HOP_FILE_PATH
HOP_RUN_CONFIG
```

Estas definen qué proyecto tienes y qué pipeline/workflow ejecutar.

**Nivel 2 — configuración por ambiente**

```text
HOP_ENVIRONMENT_NAME
HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS
HOP_RUN_PARAMETERS
```

Estas son fundamentales para separar `dev`, `test`, `staging` y `production`.

**Nivel 3 — operación**

```text
HOP_LOG_LEVEL
HOP_LOG_PATH
HOP_OPTIONS
HOP_SHARED_JDBC_FOLDERS
```

Controlan logging, JVM y conectividad JDBC.

**Nivel 4 — infraestructura avanzada**

```text
HOP_CUSTOM_ENTRYPOINT_EXTENSION_SHELL_FILE_PATH
HOP_SYSTEM_PROPERTIES
HOP_CONFIG_OPTIONS
HOP_COMMAND
HOP_COMMAND_PARAMETERS
HOP_DRIVERS_DOWNLOAD
HOP_DRIVERS_MAVEN_REPO
```

Son especialmente interesantes para CI/CD, automatización, plugins, drivers y entornos empresariales.

**Nivel 5 — Hop Server**

```text
HOP_SERVER_HOSTNAME
HOP_SERVER_PORT
HOP_SERVER_AUTH
HOP_SERVER_USER
HOP_SERVER_PASS
HOP_SERVER_SHUTDOWN_TIMEOUT
HOP_SERVER_METADATA_FOLDER
HOP_SERVER_MAX_LOG_LINES
HOP_SERVER_MAX_LOG_TIMEOUT
HOP_SERVER_MAX_OBJECT_TIMEOUT
HOP_SERVER_KEYSTORE
HOP_SERVER_KEYSTORE_PASSWORD
HOP_SERVER_KEY_PASSWORD
```

Estas solamente pasan a ser prioritarias cuando utilizas Hop como servidor persistente.

Un detalle importante: la página actual incluye algunas variables que aparecen en documentación anterior con nombres distintos o que han evolucionado. Por ejemplo, `HOP_PROJECT_DIRECTORY` aparece actualmente como deprecated en favor de `HOP_PROJECT_FOLDER`. También la documentación actual incluye variables nuevas relacionadas con descarga de JDBC drivers y `HOP_SERVER_SHUTDOWN_TIMEOUT`. ([Apache Hop][1])

Finalmente, hay otra familia de variables de Apache Hop que no son exclusivas del contenedor Docker, como `HOP_CONFIG_FOLDER`, `HOP_AUDIT_FOLDER` y `HOP_PLUGIN_BASE_FOLDERS`. Estas pertenecen a la configuración general de Hop y pueden ser relevantes cuando construyas una imagen Docker personalizada. ([Apache Hop][2])

Si tu objetivo es montar **Apache Hop como motor ETL/ELT para la arquitectura predictiva de la universidad que veníamos diseñando**, la combinación que más sentido tendría sería `HOP_PROJECT_* + HOP_ENVIRONMENT_* + HOP_RUN_* + JDBC + Custom Entrypoint`, y encima de eso decidir si conviene usar **contenedores efímeros por pipeline** o **Hop Server como servicio persistente**.

[1]: https://hop.apache.org/tech-manual/latest/docker-container.html "Docker container :: Apache Hop"
[2]: https://hop.apache.org/manual/latest/variables.html?utm_source=chatgpt.com "Variables :: Apache Hop"
