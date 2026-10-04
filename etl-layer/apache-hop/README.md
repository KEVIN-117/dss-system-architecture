# Apache Hop

Configuración de Apache Hop organizada por proyecto. Cada proyecto contiene su configuración, metadata de conexiones y sus propios ambientes; no se comparten archivos de configuración entre proyectos.

## Estructura activa

```text
apache-hop/
├── README.md
├── jdbc/                         # Drivers JDBC locales, no versionados
└── projects/
    └── dss-uatf-etl/
        ├── project-config.json
        ├── environments/
        │   ├── dev-env.json
        │   ├── integration-env.json
        │   ├── integration-test.json
        │   └── prod-env.json
        ├── metadata/rdbms/       # connection objects OLTP db / DSS DW
        ├── workflows/
        ├── pipelines/
        │   ├── control/
        │   ├── source/
        │   ├── dimensions/
        │   ├── facts/
        │   └── quality/
        └── datasets/
```

## Proyecto y ambientes

`dss-uatf-etl` es el proyecto Hop para el MVP de carga directa: Jachasun OLTP (solo lectura) → Hop (extracción, validación y transformación) → esquema `dw`. El proyecto contiene lógica ETL, no el modelo ni la base del Data Warehouse. Las configuraciones `dev` y `prod` viven dentro del proyecto. Un proyecto adicional deberá tener su propio `project-config.json`, `environments/`, `metadata/`, `workflows/` y `pipelines/`.

Compose monta `projects/dss-uatf-etl` con permisos `rw` en Hop Web para que Hop Web pueda guardar cambios del proyecto. `HOP_ENVIRONMENT_NAME` selecciona el ambiente (por defecto `dev`); el wrapper registra ese ambiente y lo deja como ambiente y proyecto predeterminados de Hop Web, para que el editor de metadata y “Test connection” usen sus variables. Los contratos definitivos de conexión son `DSS_DW_*` y `OLTP_DB_*`, compartidos por las tres ENVs; la metadata `rdbms` referencia esos nombres. Compose pasa como propiedades JVM solo los endpoints `DB_DW_*`/`DB_TX_*` que los ambientes `integration` y `prod` usan para resolver host, puerto y base. Las credenciales y URLs se toman de los archivos de ambiente tal como están definidos.

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

Para `prod`, establece `HOP_ENVIRONMENT_NAME=prod` y limita el acceso de red. El montaje del proyecto permanece `rw` en dev y prod para que Hop Web no sea de solo lectura; protege el acceso de edición con autenticación y controles de acceso. Hop Web no debe estar expuesto públicamente sin autenticación/TLS y controles de acceso configurados en el proxy o contenedor.

## Metadata y drivers

Las conexiones existentes en `metadata/rdbms` son `OLTP db` y `DSS DW`; se conservan esos nombres porque ya fueron abiertos y comprobados en Hop Web. Los objetos de metadata apuntan únicamente a `OLTP_DB_*`/`DSS_DW_*`; los valores finales se mantienen sincronizados en `dev-env.json`, `integration-env.json` y `prod-env.json`. `integration-test.json` es una configuración separada con credenciales sintéticas exclusivas del smoke Docker. El layout `metadata/rdbms` es el formato estándar del metadata relacional de Hop. Coloca los drivers JDBC aprobados en `jdbc/` localmente; no versionar JARs ni cambiar versiones de driver sin validación.

Antes de empezar una sesión de desarrollo, valida la estructura y los mapeos sin conectarte ni imprimir secretos:

```powershell
python etl-layer/apache-hop/scripts/validate_project.py
```

El proyecto incluye un smoke vertical para `public.uatf_datos` y el workflow `wf_hop_publish_staged_run.hwf`. Este último solo publica un run preparado con nueve manifiestos y ocho lotes sellados; usa el publisher SQL atómico y aborta el workflow después de auditar cualquier fallo. Ejecuta `scripts/run_hop_vertical.ps1` desde la raíz para validar el smoke con fixtures. Las pipelines de extracción de otras fuentes y las transformaciones de dimensiones/hechos siguen pendientes para el Req. 6.

## Alcance del esqueleto

Los directorios de workflows, pipelines y datasets están preparados para la implementación incremental de la issue vigente; esta estructura por sí sola no afirma que existan cargas operativas ni que el despliegue productivo esté listo. Las credenciales, TLS/autenticación y valores productivos se configuran fuera del repositorio.
