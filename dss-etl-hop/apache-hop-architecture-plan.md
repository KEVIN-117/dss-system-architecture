# Plan Arquitectónico: Implementación de Apache Hop (ETL)

> **Estado:** Propuesta Activa (Opción A)
> **Propósito:** Estrategia de adopción, despliegue y desarrollo con Apache Hop para el DSS-UATF.
> **Fecha:** 2026-08-18
> **Autor:** Arquitecto de Software — DSS-UATF

---

## 1. Visión General de Apache Hop

Apache Hop (Hop Orchestration Platform) es un fork moderno de Pentaho Data Integration (Kettle). Su ventaja principal frente a Pentaho V11 es que es **100% open source (Apache 2.0)**, elimina la deuda técnica heredada, y está diseñado de forma nativa para la nube, contenedores (Docker/Kubernetes) y CI/CD.

### Cambios de Nomenclatura (Pentaho → Hop)
*   **Transformation (.ktr)** → **Pipeline (.hpl)** (Flujo de datos paralelo)
*   **Job (.kjb)** → **Workflow (.hwf)** (Flujo de control secuencial)
*   **Spoon (UI)** → **Hop GUI** (Cliente de escritorio o web)
*   **Pan / Kitchen** → **Hop-Run** (CLI de ejecución)
*   **Carte** → **Hop Server** (Servidor web ligero)

---

## 2. Topología de Despliegue y Arquitectura

Para un entorno académico robusto, separamos el entorno de desarrollo del entorno de ejecución en producción.

### 2.1 Entorno de Desarrollo (Hop Web / GUI)
Los desarrolladores no necesitan instalar Java localmente si usamos **Hop Web** vía Docker.
*   Se levanta un contenedor `apache/hop-web` apuntando a un volumen compartido (Git repository).
*   Los desarrolladores diseñan los pipelines desde el navegador.
*   Todo se guarda como archivos XML (.hpl, .hwf) que se versionan en Git.

### 2.2 Entorno de Producción (Hop Server / K8s CronJobs)
Existen dos patrones principales para producción:

**Patrón A: Ejecución Efímera (Recomendado para Batch)**
*   Se usa la imagen `apache/hop`.
*   Un orquestador externo (ej. **Kubernetes CronJobs** o crontab de Linux) levanta un contenedor efímero.
*   El contenedor ejecuta `hop-run.sh -j tu_proyecto -e prod -r local -f main_workflow.hwf`.
*   Termina, muere y libera recursos.

**Patrón B: Hop Server (Recomendado si necesitas API REST)**
*   Se levanta un contenedor persistente con `hop-server.sh`.
*   Tu backend (o Postman) llama a la API REST de Hop Server para iniciar un workflow o consultar su estado.
*   Similar al concepto del "Plano de Control" que discutimos para Java.

> **Decisión Arquitectónica sugerida:** Usar **Patrón A (Contenedores Efímeros + CronJobs)**. Es el más escalable, resiliente a fallos de memoria, y el más barato en consumo de recursos.

---

## 3. Gestión de Ciclo de Vida (Proyectos y Entornos)

Una de las mejores características de Hop es su gestión nativa de metadatos, eliminando el infierno de variables de entorno de Pentaho.

*   **Project**: Carpeta que contiene todos tus .hpl y .hwf.
*   **Environment**: Archivos de configuración (JSON) que definen variables (ej. `DB_URL`, `DB_USER`).

**Estructura del Repositorio Git (`dss-etl-hop`):**

```text
dss-etl-hop/
├── config/
│   ├── hop-config.json          # Configuración global de Hop
│   ├── projects.csv             # Registro de proyectos
│   └── environments/
│       ├── dev-env.json         # Variables: jdbc:postgresql://localhost...
│       ├── test-env.json        # Variables: jdbc:postgresql://test-db...
│       └── prod-env.json        # Variables: jdbc:postgresql://prod-db...
├── project-uatf/
│   ├── project-config.json      # Configuración del proyecto
│   ├── metadata/
│   │   ├── dataset/             # Definiciones de Unit Tests (Hop nativo)
│   │   ├── pipeline-log/        # Configuración de logging a BD
│   │   └── relational-database-connection/
│   │       ├── DSS_TRANSACTIONAL.json  # Conexión origen (usa variables)
│   │       └── DSS_WAREHOUSE.json      # Conexión destino (usa variables)
│   ├── pipelines/
│   │   ├── dim_student.hpl
│   │   ├── dim_career.hpl
│   │   └── fact_enrollment.hpl
│   └── workflows/
│       ├── load_dimensions.hwf
│       ├── load_facts.hwf
│       └── main_orchestrator.hwf
├── Dockerfile                   # Dockerfile de producción
└── docker-compose.yml           # Para levantar entorno de desarrollo local
```

---

## 4. Estrategia de Integración (ELT vs ETL en Hop)

Hop es muy rápido procesando en memoria (ETL), pero para volúmenes masivos, delegar a la base de datos (ELT) es mejor.

1.  **Lectura (Table Input):** Extraer de `DSS_TRANSACTIONAL`.
2.  **Transformación Ligera en Hop (ETL):** Limpieza de strings, mapeo de nulos, validaciones básicas usando los pasos de Hop (`String Operations`, `Value Mapper`, `Filter Rows`).
3.  **Carga (Insert / Update o Table Output):**
    *   **Opción Lenta:** Paso `Insert / Update` (hace un SELECT por cada fila para ver si hace UPDATE o INSERT).
    *   **Opción Rápida (Recomendada):** Usar `Table Output` (con batch size = 1000) hacia una tabla temporal de staging, y luego ejecutar un `SQL script` en Hop que haga el `INSERT ... ON CONFLICT DO UPDATE` masivo en la tabla final.

---

## 5. Observabilidad y Auditoría

Al igual que planeamos en Java, necesitamos saber qué falló. Hop lo trae *out-of-the-box*.

1.  **Logging Nativo a Base de Datos:**
    *   Hop permite configurar el **Pipeline Log** y el **Workflow Log** para escribir metadatos directamente a tablas de PostgreSQL (inicio, fin, registros leídos, escritos, errores, logs detallados).
2.  **Manejo de Errores (Error Handling):**
    *   Casi todos los pasos de Hop permiten definir un "Error handling".
    *   Si un registro falla (ej. truncamiento de string), en lugar de abortar el pipeline, se desvía el flujo (flecha roja) hacia un paso `Table Output` apuntando a tu tabla `etl_dead_letter`.

---

## 6. Testing Automatizado

Apache Hop tiene un framework de Unit Testing incorporado.
*   Puedes crear **Data Sets** estáticos (archivos CSV pequeños de prueba).
*   Configuras el pipeline para que, en modo de prueba, reemplace el origen de la base de datos por el Data Set.
*   Defines aserciones (el pipeline debe generar exactamente estas filas).
*   Se ejecutan en el CI/CD usando el CLI.

---

## 7. Plan de Migración (Si hay archivos Pentaho)

Si el equipo ya había avanzado algo en Pentaho:
1.  Apache Hop incluye una herramienta gráfica de importación de proyectos Pentaho.
2.  Convierte archivos `.ktr` a `.hpl` y `.kjb` a `.hwf`.
3.  Advierte si algún paso (step) de Pentaho fue deprecado o eliminado en Hop para su corrección manual.

---

## 8. Siguientes Pasos (Roadmap Táctico)

1.  **Semana 1:** Levantar Hop Web con Docker Compose y configurar las conexiones a las BD (usando variables).
2.  **Semana 2:** Diseñar el primer Pipeline (`fact_enrollment.hpl`) y configurar el logging hacia PostgreSQL.
3.  **Semana 3:** Crear el Workflow principal (`main.hwf`) y manejar desvíos de errores a la tabla de dead-letters.
4.  **Semana 4:** Empaquetar el proyecto en un contenedor Docker y probar la ejecución por lotes con `hop-run`.
