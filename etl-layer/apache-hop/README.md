# Apache Hop

Configuración de Apache Hop organizada por proyecto. Cada proyecto contiene su configuración, metadata de conexiones y sus propios ambientes; no se comparten archivos de configuración entre proyectos.

## Estructura activa

```text
apache-hop/
├── README.md
├── jdbc/                         # Driver PostgreSQL descargado y validado antes del build
└── projects/
    └── dss-uatf-etl/
        ├── project-config.json
        ├── environments/
        │   ├── dev-env.json
        │   ├── test-env.json
        │   ├── integration-env.json
        │   ├── integration-test.json
        │   └── prod-env.json
        ├── metadata/rdbms/       # connection objects OLTP db / DSS DW / Auth Service DB
        ├── workflows/
        ├── pipelines/
        │   ├── control/
        │   ├── source/
        │   ├── dimensions/
        │   ├── facts/
        │   └── quality/
        └── datasets/
```

Antes de construir la imagen localmente, ejecuta `bash scripts/download-postgres-jdbc.sh` desde `etl-layer/apache-hop`; el script descarga PostgreSQL JDBC 42.7.11 y valida su SHA-256. CI y el flujo de publicación ejecutan este paso automáticamente.

## Proyecto y ambientes

`dss-uatf-etl` es el proyecto Hop para el MVP de carga directa: Jachasun OLTP (solo lectura) → Hop (extracción, validación y transformación) → esquema `dw`. El proyecto contiene lógica ETL, no el modelo ni la base del Data Warehouse. Las configuraciones `dev` y `prod` viven dentro del proyecto. Un proyecto adicional deberá tener su propio `project-config.json`, `environments/`, `metadata/`, `workflows/` y `pipelines/`.

`etl-layer/apache-hop/Dockerfile` empaqueta Apache Hop Web 2.19.0, el proyecto `dss-uatf-etl`, el wrapper de inicio y el driver PostgreSQL 42.7.11 en `/usr/local/tomcat/jdbc-drivers`, el directorio JDBC de Hop Web. `HOP_SHARED_JDBC_FOLDERS` apunta al mismo directorio para que el classloader de Hop encuentre el controlador. La imagen excluye los archivos activos de ambiente; incluye las plantillas sanitizadas. El proyecto se copia como propiedad del usuario `hop`, que ejecuta Hop Web, para permitirle crear y actualizar archivos de configuración dentro de `environments/`. Compose monta el proyecto y el wrapper en desarrollo para conservar la edición desde Hop Web. El driver viene en la imagen y no se monta desde el host.

`HOP_ENVIRONMENT_NAME` selecciona el ambiente predeterminado (por defecto `dev`); el wrapper registra ese ambiente y también los perfiles disponibles indicados por `HOP_ADDITIONAL_ENVIRONMENT_NAMES` (por defecto `dev,test`), cada uno con su propio archivo `*-env.json`. Así aparecen en el selector de Hop Web, mientras que el predeterminado sigue siendo el seleccionado por Compose. En producción, configura `HOP_ENVIRONMENT_NAME=prod` y deja `HOP_ADDITIONAL_ENVIRONMENT_NAMES` vacío para no cargar perfiles locales en la instancia productiva. Los contratos definitivos de conexión son `DSS_DW_*` y `OLTP_DB_*`; la metadata `rdbms` referencia esos nombres. Compose pasa como propiedades JVM solo los endpoints `DB_DW_*`/`DB_TX_*` que los ambientes `integration` y `prod` usan para resolver host, puerto y base. Las credenciales y URLs se toman de los archivos de ambiente correspondientes.

Para desarrollo local, define en el `.env` ignorado del repositorio los endpoints que Hop recibe como propiedades JVM:

```dotenv
HOP_ENVIRONMENT_NAME=dev
HOP_WEB_PORT=8081
DB_DW_HOST=host.docker.internal
DB_DW_PORT=5434
DB_TX_HOST=host.docker.internal
DB_TX_PORT=5432
```

Los nombres de base se toman de `POSTGRES_DW_NAME` y `POSTGRES_TX_NAME`. No configures Hop con `HOP_DSS_*`/`HOP_OLTP_*`: no son las variables de conexión que referencia la metadata del proyecto. Las credenciales permanecen en el archivo de ambiente seleccionado, sin cambiar los valores acordados.

Las URLs aprobadas en los archivos de ambiente usan `host.docker.internal:5434` para el DW y `host.docker.internal:5432` para Jachasun; Compose publica el DW por `5434` y el OLTP remoto debe publicar `5432` en el host. La cuenta configurada por `DSS_DW_USERNAME` debe pertenecer solo a `dw_hop_runtime`; 0010–0012 limitan ese grupo a funciones controladas y un publisher atómico sin DML directo. Para producción, verificar con TI/DBA que las credenciales runtime de cada ambiente sean dedicadas y de privilegio mínimo.

Para `prod`, parte de `environments/prod-env.example.json` y entrega el archivo local `prod-env.json` mediante el gestor de secretos aprobado; la plantilla no inventa hosts ni credenciales. Establece `HOP_ENVIRONMENT_NAME=prod`, configura `HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS=/files/project/environments/prod-env.json`, deja `HOP_ADDITIONAL_ENVIRONMENT_NAMES` vacío y limita el acceso de red. Monta el archivo de ambiente en esa ruta, no un directorio completo de solo lectura: Hop Web debe poder crear archivos auxiliares de conexión en `environments/`. La imagen deja el proyecto bajo la propiedad de `hop` para esos cambios. Protege el acceso de edición con autenticación y controles de acceso; Hop Web no debe estar expuesto públicamente sin autenticación/TLS y controles de acceso configurados en el proxy o contenedor.

## Metadata y drivers

Las conexiones de `metadata/rdbms` son `OLTP db`, `DSS DW` y `Auth Service DB`. Sus objetos usan, respectivamente, `OLTP_DB_*`, `DSS_DW_*` y `AUTH_CATALOG_DB_*`. El usuario de Hop para `Auth Service DB` debe tener privilegios mínimos para sincronizar el catálogo académico; sus credenciales se guardan en el archivo local ignorado o en el gestor de secretos aprobado, nunca en los ejemplos versionados. Los ambientes que ejecuten pipelines que usen esta conexión deben definir las seis variables del catálogo. `integration-test.example.json` mantiene credenciales sintéticas exclusivas del smoke Docker y debe apuntar a una base de catálogo de prueba disponible en esa red antes de ejecutar pipelines que la utilicen. El layout `metadata/rdbms` es el formato estándar del metadata relacional de Hop. La imagen de runtime fija el driver PostgreSQL 42.7.11; no cambiarlo sin validar su compatibilidad.

Antes de empezar una sesión de desarrollo, valida la estructura y los mapeos sin conectarte ni imprimir secretos:

```powershell
python etl-layer/apache-hop/scripts/validate_project.py
```

El proyecto incluye `wf_vertical_uatf_datos_smoke.hwf`, que integra las nueve fuentes, cinco dimensiones, SCD2 de estudiante, los tres hechos, gates y publicación SQL atómica. `wf_hop_publish_staged_run.hwf` conserva además una prueba enfocada del publisher con nueve manifiestos y ocho lotes sellados. Ejecuta `scripts/run_hop_vertical.ps1` desde la raíz para la prueba con fixtures. La implementación del MVP está completa; la configuración y autorización de una operación productiva siguen siendo actividades de despliegue, no una dependencia de desarrollo del Req. 6.

## Alcance implementado

El proyecto contiene los workflows y pipelines del MVP directo y las pruebas de integración correspondientes. La configuración productiva (secretos, TLS/autenticación, cuentas runtime, red y autorizaciones de corte) se suministra fuera del repositorio y debe revisarse antes de cada despliegue; la existencia del proyecto no habilita por sí sola una carga productiva.
