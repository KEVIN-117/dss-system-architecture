# Reporte de pruebas del DSS

**Actualización editorial:** 23 de noviembre de 2026 · **Corridas registradas:** 11 y 23 de noviembre de 2026, más la repetición del 23/11 posterior a las correcciones
**Alcance:** resultados locales que constan en los logs enumerados en este reporte. Las corridas iniciales no identifican un SHA de commit; la repetición posterior a las correcciones corresponde al contenido publicado en el commit `d78d42ed` (PR #379). La evidencia no equivale a aceptación institucional.

## Estado actual de la evidencia

**Tras las correcciones del 23/11, las suites automatizadas registradas quedan aprobadas.** La corrida inicial del 23/11 tenía tres resultados abiertos: el perfil de integración OLAP falló, el flujo vertical del DW no llegó a iniciar y el E2E de administración no produjo resumen. Los tres se diagnosticaron y se repitieron (sección [Repetición del 23 de noviembre tras correcciones](#repetición-del-23-de-noviembre-tras-correcciones)). Este reporte conserva ambos estados y no interpreta una prueba técnica como aceptación institucional.

Los resultados que siguen requiriendo atención o evidencia adicional son:

- OLAP, perfil de integración: aprobado con alcance reducido. Se excluyeron 14 clases IT que dependían de los cubos de ejemplo de Saiku, que ya no forman parte del despliegue; deben portarse a los cubos académicos para recuperar esa cobertura.
- Modelos: PRED-004 sigue siendo un experimento sintético con decisión `EVIDENCIA_INSUFICIENTE`; no se volvió a ejecutar el 23/11.
- E2E de rectorado: los dos escenarios de publicación predictiva con capturas de fallo no se repitieron.
- Rendimiento y usabilidad institucional: sin una nueva medición aceptada ni evaluación documentada con participantes.

## Ejecución local del 23 de noviembre de 2026

Los resultados siguientes se extrajeron de los logs creados el 23/11/2026. Las rutas corresponden a la copia local; algunos archivos contienen datos operativos o detalles internos y deben revisarse antes de distribuirse fuera del equipo.

| Componente o flujo | Resultado del log | Estado |
|---|---:|---|
| Auth Service | 352 pruebas; 0 fallos, 0 errores y 0 omitidas. `BUILD SUCCESS`. | Aprobada. |
| DW Control Service | 87 pruebas; 0 fallos, 0 errores y 2 omitidas. `BUILD SUCCESSFUL`. | Aprobadas las ejecutadas; conservar la explicación de las 2 omitidas. |
| Keycloak Webhook | 33 pruebas; 0 fallos, 0 errores y 0 omitidas. `BUILD SUCCESS`. | Aprobada. |
| OLAP, suite predeterminada | 974 pruebas; 0 fallos, 0 errores y 1 omitida. `BUILD SUCCESS`. | Aprobadas las ejecutadas; una omitida. |
| OLAP, perfil de integración | 132 pruebas; 64 aprobadas, 67 fallidas y 1 error. `BUILD FAILURE`. | Fallida en la corrida inicial; aprobada en la repetición (ver más abajo). |
| Prediction Service, unitarias | 197 pruebas; resultado `OK`. | Aprobada. |
| Ciclo de vida ML | 3 aserciones aprobadas: recarga del paquete tras reinicio, volumen compartido entre API y worker, y persistencia del puntero/artefacto. | Smoke test aprobado. |
| Regresión de esquema DW (`test.dw_01.log`) | El contenedor de pruebas terminó con código 0; el log registra comprobaciones de checksum de migración, concurrencia de locks y compatibilidad. | Aprobada según salida del contenedor. El error de clave duplicada forma parte del escenario de contención y va seguido por “Lock concurrency test passed”. |
| Contrato de consultas fuente (`test.integration.log`) | Las nueve consultas de solo lectura pasaron contra un fixture sintético de Jachasun. | Aprobada con fixture; no es acceso a una base institucional. |
| Flujo vertical DW (`test.dw_vetical.log`) | Docker no pudo enlazar `127.0.0.1:5433` porque el puerto estaba ocupado. | No ejecutada en la corrida inicial; aprobada en la repetición (ver más abajo). |
| Vitest de aplicaciones | 366/366 aprobadas: BFF 201, Administración 109, Dirección 20, Decanato 6, Landing 12 y Rectorado 18. | Aprobada para las suites registradas. |
| Vitest de bibliotecas | 65/65 aprobadas: Auth Connector 25, DW Control Connector 13, ML Connector 8, OLAP Connector 14 y OLAP Data Access 5. | Aprobada para las suites registradas. |
| Auth Models | El comando registró “No test files found” y salió con código 1. | Sin casos de prueba encontrados; no contabilizar como suite aprobada. |
| Playwright BFF | 9/9 aprobadas en Chromium, Firefox y WebKit. | Aprobada para este flujo. El log reporta tareas Nx recuperadas de caché para dependencias. |
| Playwright Administración | El log registra arranque de Next.js y respuesta 200 a `/`, pero no muestra resumen ni conteo final de Playwright. | No atribuible en la corrida inicial (la ejecución quedó colgada); 27/27 en la repetición (ver más abajo). |

### Casos de integración OLAP fallidos identificables

El log de integración registra, entre otros, los siguientes resultados: `TotalsFormatIT` esperaba HTTP 200 y recibió HTTP 400; `UserWorkflowIT` no encontró el cubo Sales; `AdvancedAiQueryIT.multipleFiltersOnSameHierarchy_rejectedAsValidationError` encontró un error de cubo desconocido; y `OssieTileQueryIT` recibió errores de validación de datasource. El reporte Failsafe de `saiku-launcher/target/failsafe-reports` conserva el detalle de los 67 fallos y el error.

La revisión posterior identificó dos causas:

1. **Datos de ejemplo ausentes (66 fallos y el error).** Esas clases consultan el cubo FoodMart y los datasources Ossie de demostración del Saiku original. En este despliegue esos ejemplos solo se siembran en modo demo, y el seed `foodmart_h2.sql.zip` nunca se incorporó al repositorio, así que el servidor de pruebas arranca sin la conexión `foodmart` (de ahí los errores de cubo desconocido y las listas vacías).
2. **Defecto real en `AdminIT.getUsers_asAdmin_ok` (1 fallo).** `GET /rest/saiku/admin/users` respondía HTTP 400 por `IllegalArgumentException: SQL must not be null`. `JdbcUserDAO` lee `database-queries.properties` desde el classpath, pero el archivo estaba en `saiku-api/src/main/webapp/WEB-INF/`, fuera del classpath, por lo que todas las consultas de usuarios quedaban sin cargar.

### Evidencia de la corrida

| Grupo | Ruta local del log |
|---|---|
| Auth, DW Control y Webhook | `auth-service/test.log`, `dw-control-service/test.log`, `keycloak-webhook/test.log` |
| OLAP | `olap-service/test.log`, `olap-service/test.integration.log` |
| Predicción | `prediction-service/test.log`, `prediction-service/test_ml_lifecycle_smoke.log` |
| DW | `test.dw_01.log`, `test.dw_vetical.log`, `test.integration.log` |
| Portales, conectores y E2E | `dss-monorepo/test.*.log` |

Los logs se conservaron en el árbol de trabajo local. No se registra en ellos el SHA del commit ejecutado, por lo que los conteos se atribuyen a la corrida fechada y no a una revisión inmutable.

## Repetición del 23 de noviembre tras correcciones

Los tres resultados abiertos de la corrida inicial se diagnosticaron y se repitieron el mismo día. Las correcciones se publicaron en el commit `d78d42ed` (PR #379), que corresponde al árbol de trabajo sobre el que se repitieron las suites.

| Componente o flujo | Corrida inicial | Causa identificada | Corrección | Resultado de la repetición |
|---|---|---|---|---|
| OLAP, perfil de integración | 64 aprobadas, 67 fallidas y 1 error (de 132). | Clases IT dependientes de los cubos de ejemplo de Saiku, ausentes en este despliegue, y `database-queries.properties` fuera del classpath (ver la sección anterior). | Se movió `database-queries.properties` a `saiku-api/src/main/resources/`. Se excluyeron del failsafe (`saiku-launcher/pom.xml`) 14 clases IT que solo prueban los cubos de ejemplo; se conservan para portarlas a los cubos académicos. | `BUILD SUCCESS`: 55/55 IT en 14 clases (incluido `AdminIT` 11/11), suites unitarias del reactor sin fallos y Spotless aprobado. |
| Flujo vertical DW | No ejecutado: puerto 5433 ocupado. | Otro entorno de fixtures seguía publicando el puerto; no es un defecto de código. | Repetición con puertos aislados (`DW_INTEGRATION_SOURCE_PORT=55432`, `DW_INTEGRATION_TARGET_PORT=55433`, los mismos de `infra/dw-integration/run-local-vertical.sh`) y baja del proyecto al terminar. | Aprobado: extracción Hop de 9 fuentes, 5 dimensiones, 3 lotes de hechos, publicación atómica, clasificación de retención, rechazo por rango de notas y SCD2. |
| Playwright Administración | Sin resumen: la ejecución quedaba colgada tras arrancar Next.js. | Las dependencias inferidas por `@nx/playwright` (`admin-portal:dev` + `wait-for-webserver`) nunca dejaban arrancar Playwright. Además, un selector desactualizado por el rediseño del panel de usuarios, y sobrecarga de compilación en frío con 8 workers en tres navegadores. | Se aplicó el patrón de `bff-e2e` y `rector-dashboard-e2e` (`dependsOn: ["^build"]` y `next dev` directo); se agregó `global-setup.ts`, que precompila las rutas; se limitaron a 4 los workers locales (CI conserva 1 worker y 2 reintentos), y se actualizó el selector en `user-management.spec.ts`. | 27/27 aprobadas en Chromium, Firefox y WebKit. |

**Alcance de la exclusión OLAP.** Las clases excluidas son `AdvancedAiQueryIT`, `AiQueryAsyncIT`, `AiQueryExtrasIT`, `AiQueryIT`, `AppBuilderIT`, `DrillthroughIT`, `MeasureFilterIT`, `OlapDiscoverIT`, `OssieTileQueryIT`, `Query2AdvancedIT`, `Query2ResourceIT`, `QueryNameCollisionIT`, `TotalsFormatIT` y `UserWorkflowIT`. Algunas incluían también casos de validación que sí pasaban; dejan de ejecutarse con la exclusión. La API de consultas OLAP no tiene, por tanto, cobertura de integración contra los cubos académicos hasta portar esas pruebas.

| Grupo | Ruta local del log de la repetición |
|---|---|
| OLAP, perfil de integración | `olap-service/test.integration.rerun.log` |
| Flujo vertical DW | `test.dw_vertical.rerun.log` |
| Playwright Administración | `dss-monorepo/test.e2e_admin.rerun.log` |

Comandos de la repetición:

```powershell
# OLAP: perfil de integración, desde olap-service
mvn -B -ntp -DskipITs=false -DskipTests=false verify
# Flujo vertical DW con puertos aislados, desde la raíz del repositorio (bash)
DW_INTEGRATION_SOURCE_PORT=55432 DW_INTEGRATION_TARGET_PORT=55433 docker compose -p dss-dw-vertical -f infra/dw-integration/dw-integration-test.yml --profile dw-vertical run --rm hop-vertical-assert
docker compose -p dss-dw-vertical -f infra/dw-integration/dw-integration-test.yml --profile dw-vertical down --volumes --remove-orphans
# Playwright Administración, desde dss-monorepo
bunx nx run @dss-monorepo/admin-portal-e2e:e2e
```

## Ejecución local del 11 de noviembre de 2026

Se ejecutaron suites de servicios, bibliotecas y portales. Docker estaba detenido al inicio; las pruebas del DW y el ciclo predictivo iniciaron proyectos temporales aislados y los retiraron al terminar. Los logs de esta sesión quedaron en `dss-monorepo/.tmp/doc36-test-logs` (directorio local temporal).

| Componente | Resultado |
|---|---|
| Auth Service | 157/157 aprobadas. |
| DW Control | 6/6 aprobadas. |
| Keycloak Webhook | 8/8 aprobadas. |
| OLAP (suite predeterminada) | 2.808/2.815 aprobadas; 7 omitidas. |
| OLAP (perfil integración) | 67/135 aprobadas, 67 fallidas y 1 error. Varios casos recibieron HTTP 400 cuando esperaban 200. |
| Prediction Service (unitarias) | 112/112 aprobadas. |
| DW/Hop | Validación del proyecto, regresión de esquema, contrato de nueve fuentes, workflow vertical y publicación atómica aprobados con fixtures. |
| Prediction lifecycle smoke | Tres aserciones aprobadas: volumen compartido, persistencia del puntero/artefacto y recarga tras reiniciar API. |
| Vitest de aplicaciones | 180/186 aprobadas; 6 fallidas y 1 error no controlado (cuatro del proxy OLAP y dos del alcance GraphQL del BFF). |
| Vitest de bibliotecas | 47/47 aprobadas. |
| Playwright Chromium | 20/20 aprobadas: BFF 3, administración 3, Landing 4, Decanato 4, Dirección 3 y Rectorado 3. |

### Casos fallidos identificables en los logs

Los logs conservan el nombre y la salida de los fallos siguientes. Se incluyen ejemplos concretos para que la tabla de resultados no oculte el comportamiento observado; no son una lista exhaustiva de todas las aserciones fallidas.

| Suite y caso | Resultado esperado | Resultado observado |
|---|---|---|
| BFF `analytics.spec.ts`: derivar el alcance de Director desde los contextos de Auth Service. | Obtener el alcance académico del contexto validado. | `TypeError: deriveAcademicScope is not a function`. |
| BFF `analytics.spec.ts`: mantener los alcances de Decano y Rector aunque haya roles compuestos inferiores. | Conservar el alcance correspondiente al rol. | `TypeError: deriveAcademicScope is not a function`. |
| BFF `route.spec.ts`: reenviar el Bearer token verificado al servicio OLAP. | HTTP 200 del proxy en el escenario autorizado. | HTTP 403. |
| BFF `route.spec.ts`: preservar la barra final de la ruta de Saiku. | Reenviar la ruta incluyendo la barra final. | La prueba recibió un valor indefinido al inspeccionar la solicitud reenviada. |
| BFF `route.spec.ts`: devolver 504 cuando el servicio OLAP excede el tiempo límite. | HTTP 504. | HTTP 403; Vitest también registró un rechazo no controlado asociado a este escenario. |
| BFF `route.spec.ts`: permitir rutas OLAP ordinarias a roles autenticados que no son administradores. | HTTP 200. | HTTP 403. |
| OLAP `AdminIT.getUsers_asAdmin_ok`, `AdvancedAiQueryIT.topNIsUnaffected` y `AiQueryAsyncIT.asyncQueryRoundTrip_submitPollResult`. | Respuestas satisfactorias según cada caso de integración. | Los casos aparecen como fallidos en `olap-integration.log`; varios casos de esa suite recibieron HTTP 400 cuando esperaban HTTP 200. |

La causa raíz de estos resultados no se determina solo con el resumen. Antes de describir una corrección, debe vincularse cada fallo con el diagnóstico y con una ejecución posterior que lo confirme.

### Comandos por componente

Ejecutar los comandos Maven, Gradle y Python desde la raíz del servicio indicada; los comandos Vitest y Playwright desde `dss-monorepo`.

```powershell
# Auth Service
cd auth-service; .\mvnw.cmd --batch-mode --no-transfer-progress test
# DW Control Service
cd dw-control-service; .\gradlew.bat test --rerun-tasks
# Keycloak Webhook
cd keycloak-webhook; mvn --batch-mode --no-transfer-progress verify
# OLAP: suite predeterminada
cd olap-service; mvn --batch-mode --no-transfer-progress -DskipTests=false verify
# OLAP: perfil de integración
mvn --batch-mode --no-transfer-progress -pl saiku-launcher -am -P integration verify
# Prediction Service
cd prediction-service; uv run --no-sync python -m unittest discover -s tests -p "test_*.py" -v
# DW / Apache Hop, desde dss-monorepo
python etl-layer\apache-hop\scripts\validate_project.py
docker compose -f infra/dw-schema/dw-test-docker.yml up --build --exit-code-from dw-schema-test
docker compose -p dss-dw-source-contract -f infra/dw-integration/dw-integration-test.yml --profile dw-req6-sources run --rm hop-source-query-contract-test
docker compose -p dss-dw-vertical -f infra/dw-integration/dw-integration-test.yml --profile dw-vertical run --rm hop-vertical-assert
docker compose -p dss-dw-publish -f infra/dw-integration/dw-integration-test.yml --profile dw-publish run --rm hop-publish-assert
# Prediction lifecycle smoke, desde prediction-service
.\tests\integration\run_lifecycle_compose_smoke.ps1 -Port 15435
# Vitest: ejecutar individualmente desde dss-monorepo
bunx vitest run --config apps/bff/vitest.config.mts
bunx vitest run --config apps/admin-portal/vitest.config.mts
bunx vitest run --config apps/director-dashboard/vitest.config.mts
bunx vitest run --config apps/decano-dashboard/vitest.config.mts
bunx vitest run --config apps/rector-dashboard/vitest.config.mts
bunx vitest run --config apps/landing/vitest.config.mts
bunx vitest run --config libs/shared/auth-models/vitest.config.mts
bunx vitest run --config libs/connectors/auth-connector/vitest.config.mts
bunx vitest run --config libs/connectors/dw-control-connector/vitest.config.mts
bunx vitest run --config libs/connectors/ml-connector/vitest.config.mts
bunx vitest run --config libs/connectors/olap-connector/vitest.config.mts
bunx vitest run --config libs/shared/olap-data-access/vitest.config.mts
# Playwright, Chromium y localmente levantando el portal/BFF que corresponda
bunx playwright test --config apps/bff-e2e/playwright.config.mts
bunx playwright test --config apps/admin-portal-e2e/playwright.config.mts
bunx playwright test --config apps/landing-e2e/playwright.config.mts
bunx playwright test --config apps/decano-dashboard-e2e/playwright.config.mts
bunx playwright test --config apps/director-dashboard-e2e/playwright.config.mts
bunx playwright test --config apps/rector-dashboard-e2e/playwright.config.mts --grep-invert "prediction-publication"
```

Las pruebas E2E excluyeron los dos casos de publicación predictiva que requieren cuentas/datos preaprovisionados y el workspace OLAP que requiere servicios autenticados. El alcance fue Chromium. PRED-008 no se reejecutó porque depende de sesiones autenticadas de Rectorado y Superadmin, además de un servicio de inferencia disponible. La evaluación de usabilidad institucional sigue pendiente. Los seis fallos de Vitest, el error no controlado y la suite de integración OLAP deben diagnosticarse y repetirse.

El inventario siguiente separa la existencia de suites de los resultados efectivamente obtenidos en esta corrida.
## Resumen ejecutivo

La verificación del DSS abarca pruebas unitarias y de componentes en Auth Service, DW Control, servicios de datos y portales; pruebas SQL y de integración del Data Warehouse; flujos E2E; experimentación del pipeline predictivo; y una prueba de carga exploratoria.

Se encontraron evidencias de ejecución que permiten complementar la matriz del informe:

- **Integración vertical del DW:** el cierre de Req. 6 registra una ejecución Docker exitosa con nueve manifiestos, cinco dimensiones, tres hechos y ocho lotes; incluye rechazo de nota fuera de rango, reglas de retención, SCD2 y publicación atómica. Los datos son fixtures sintéticos; no es una carga productiva.
- **Experimento predictivo PRED-004:** comparación reproducible con datos sintéticos, 30 casos de entrenamiento, 10 de prueba y validación de tres folds. La decisión registrada es `EVIDENCIA_INSUFICIENTE` y no hay ganador único; no habilita despliegue institucional.
- **Carga predictiva PRED-008:** el artefacto del 5 de noviembre de 2026 está marcado `INCOMPLETE` y `CHARACTERIZATION_ONLY`; no se fijaron umbrales. En las solicitudes registradas, inferencia respondió HTTP 502. Es una señal de problema en ese entorno de desarrollo y no una medición de capacidad aceptada.
- **E2E del portal de rectorado:** hay seis capturas `test-failed-1.png` para dos escenarios en Chromium, Firefox y WebKit. El artefacto prueba que esos intentos fallaron en esa ejecución, pero no conserva en ese directorio el resumen ni la causa suficiente para atribuir el fallo.

La presencia de archivos de prueba acredita procedimientos, no resultados. La corrida local fechada en esta actualización aporta resultados para los grupos indicados, aunque no consolida todos los escenarios ni sustituye la repetición en un commit limpio.

## Inventario de pruebas identificadas

| Grupo | Alcance identificado | Ubicación representativa | Estado de la evidencia |
|---|---|---|---|
| Auth Service | JWT, validación de identidad, contextos académicos, directorio de usuarios y configuración de ambiente de prueba. | `auth-service/src/test`; `.test-run.log` está vacío (0 bytes). | Suites presentes; el archivo de log no aporta resultados. |
| DW Control y autorización | Política de transición de cierres y configuración de seguridad. | `dw-control-service` y `infra/dw-schema/tests`. | Aserciones automatizadas disponibles; sin resumen global de ejecución identificado. |
| Esquema e integridad del DW | Calendario académico, capas analíticas y roles, dimensiones conformadas, control de ejecución, concurrencia, migraciones, publicaciones predictivas, gates, publisher atómico y SCD2. | `infra/dw-schema/tests/` (`*.sql`, `*.sh`). | Las aserciones de la integración Req. 6 están respaldadas por el cierre documentado; las demás suites no se consideran ejecutadas por ese solo hecho. |
| Integración Apache Hop–DW | Extracción de nueve fuentes, preparación de dimensiones y hechos, sellado de lotes, controles de calidad y publicación atómica. | `infra/dw-integration/`, `etl-layer/apache-hop/`; `docs/dw/hop-req-6-progress.md`. | Ejecución documentada como exitosa sobre fixtures sintéticos. |
| Servicios predictivos | Contrato y carga de dataset, preparación, balanceo, entrenamiento, evaluación/comparación, inferencia, artefactos, registro y publicaciones. | `prediction-service/tests/` y `prediction-service/tests/integration/`. | Suites disponibles; PRED-004 aporta experimento ejecutado y PRED-008 aporta una caracterización de carga incompleta. |
| BFF y conectores | GraphQL de analítica/contexto, autenticación y callback, sesión, autorización, rutas OLAP y predictivas, conectores de Auth/OLAP/ML/DW. | `dss-monorepo/apps/bff/` y `dss-monorepo/libs/connectors/` (`*.spec.ts`). | Pruebas de componentes presentes; no se localizó un reporte integral fechado. |
| Portales y bibliotecas web | Componentes de tableros, acceso RBAC, permisos, datos de analítica, gráficos, rutas protegidas y diseño compartido. | `dss-monorepo/apps/`, `dss-monorepo/libs/` (`*.spec.ts`, `*.spec.tsx`). | Suites disponibles; su presencia no equivale a aceptación institucional. |
| E2E de portales | Flujos Playwright para workspace OLAP, BFF, landing, administración, decanato, dirección y rectorado; este último incluye publicaciones predictivas. | `dss-monorepo/apps/*-e2e/`. | Se encontraron capturas de fallos de dos casos del portal de rectorado en tres navegadores; no se halló un resumen de ejecución que permita cuantificar aprobación global. |
| Rendimiento | Utilidades de carga, cálculo de percentiles/errores y carga del flujo de predicción. | `prediction-service/tests/test_prediction_load_test.py`, `tests/integration/prediction_load_test.py`. | Hay pruebas de la instrumentación y un artefacto PRED-008 de caracterización; falta una medición institucional con umbrales acordados. |
| Usabilidad | No se encontró protocolo, muestra de participantes ni acta de evaluación institucional. | Pendiente de planificar. | No ejecutada/documentada en la evidencia revisada. |

## Resultados reproducibles conservados

### DW-INT-01 — integración vertical

El documento de cierre de Req. 6 describe una ejecución con contenedores Docker y fixtures. Se prepararon y publicaron nueve manifiestos de origen, cinco dimensiones, tres hechos y ocho lotes sellados. Las aserciones documentadas abarcan nota fuera del intervalo `[0,100]`, transiciones SCD2, clasificación `RETENIDO`/`DESERTOR`/`NO_EVALUABLE`, gates de publicación y atomicidad del publisher. El cierre 2025/2 aparece como `PROCESADO`.

**Interpretación:** evidencia de que el MVP de integración funciona con los fixtures definidos. No demuestra ejecución histórica productiva, carga con datos reales ni tiempos de operación institucional.

**Fuente:** `docs/dw/hop-req-6-progress.md`, secciones “Informe de cierre”, “Implementación de 6.4–6.6” y “Prueba reproducible”. El mismo documento conserva los comandos Docker para reproducirla.

### ML-EXP-01 — PRED-004, comparación sintética

El artefacto `docs/prediction/evidence/PRED-004-synthetic-comparison.json` tiene fecha `2026-10-28T14:15:09Z`. Registra Random Forest y XGBoost usando el mismo dataset/partición sintéticos: 30 filas y grupos de estudiantes para entrenamiento, 10 para prueba temporal independiente y validación estratificada agrupada de tres folds. La identidad de estudiantes entre entrenamiento y prueba está separada. El JSON conserva métricas por modelo, pero el estado de decisión general es `EVIDENCIA_INSUFICIENTE`, la selección de candidato es `NO_UNIQUE_WINNER` y `comparison` es nulo.

**Interpretación:** el experimento acredita el flujo de evaluación y su decisión cautelosa; las métricas de un fixture pequeño no estiman desempeño institucional.

### PRED-008 — caracterización de carga

El artefacto local `prediction-service/.test-tmp/PRED-008-isolated-load-report.json` se generó el `2026-11-05 19:35:18 -04:00` en ambiente `development`. Define dos clientes y escenarios de 10 segundos, pero declara `NOT_SET_CHARACTERIZATION_ONLY` para umbrales y termina con `execution_status: INCOMPLETE` y `decision: CHARACTERIZATION_ONLY`.

En el escenario base con Random Forest, los endpoints de salud BFF, dashboard, publicación y publicación vía BFF registraron respuestas 200 en las solicitudes informadas. Inferencia registró 8 errores de 8 solicitudes (HTTP 502), con p95 de 8.131 ms. Durante entrenamiento activo, inferencia registró 34 errores de 34 (HTTP 502), con p95 de 1.507 ms; los endpoints restantes del resumen respondieron 200. Los valores describen esa ejecución incompleta y no son un SLA ni una aceptación de rendimiento. El artefacto `PRED-008-load-report.json` también existe, pero no se usa aquí para combinar resultados porque presenta otra corrida/volumen y está igualmente incompleto.

### E2E — capturas de escenarios fallidos

Playwright conservó capturas para los escenarios de publicación “nota válida fuera del ámbito” y “GraphQL y ve el lote completo”, cada uno en Chromium, Firefox y WebKit. Las rutas de las seis capturas son:

- `dss-monorepo/apps/rector-dashboard-e2e/test-output/playwright/output/prediction-publication-PRE-696ce-nta-válida-fuera-del-ámbito-{chromium,firefox,webkit}/test-failed-1.png`
- `dss-monorepo/apps/rector-dashboard-e2e/test-output/playwright/output/prediction-publication-PRE-3aec6-aphQL-y-ve-el-lote-completo-{chromium,firefox,webkit}/test-failed-1.png`

Antes de incorporar estas imágenes al informe final como evidencia explicativa, conviene asociarlas con el mensaje de error, versión de la app y fecha de ejecución: el archivo de captura por sí solo no establece la causa.

## Matriz de resultados y límites

| Prueba | Resultado atribuible | Conclusión para el informe |
|---|---|---|
| Unitaria / componente | Suites identificadas en Java, Python, TypeScript y SQL; la corrida histórica del 11/11 no consolidó todos los resultados. | Reportar los conteos disponibles por componente y conservar el corte histórico separado del 23/11. |
| Integración DW | Req. 6: 9 manifiestos, 5 dimensiones, 3 hechos y 8 lotes; cierre `EXITOSA` descrito en el registro. | Ejecutada con fixtures sintéticos; no equivale a prueba productiva. |
| Calidad e integridad DW | Aserciones de rechazo de nota 101, transiciones SCD2, clasificación de retención, sellado/gates y publicación atómica. | Atribuibles al flujo de integración documentado y a pruebas transaccionales; conservar su alcance sintético. |
| Funcional / permisos | Specs para GraphQL, login, callback, contexto, conectores y portales. El 23/11: Playwright BFF 9/9 y Administración 27/27 en tres navegadores; integración OLAP 55/55 con alcance reducido. Se mantienen seis capturas de fallos E2E de rectorado. | No afirmar aceptación funcional integral; investigar y documentar los fallos de rectorado y portar las IT OLAP excluidas antes de cerrar el resultado. |
| Pipeline ML | PRED-004, dos algoritmos, 30/10, tres folds, decisión `EVIDENCIA_INSUFICIENTE`. | Experimento sintético ejecutado; no seleccionar modelo ni autorizar despliegue. |
| Rendimiento | PRED-008 incompleto, umbrales ausentes, respuestas 502 en inferencia. | Caracterización exploratoria; repetir con servicio sano, carga acordada y criterios previos. |
| Usabilidad | Sin evidencia de sesiones con participantes institucionales. | Pendiente; no contabilizar como prueba ejecutada. |

## Evidencia visual y anexos

Las seis capturas de Playwright son candidatas a anexarse como evidencia de fallos, una por escenario/navegador. No se recomienda presentarlas como demostración de un recorrido satisfactorio. Para una versión final más sólida, exportar el resumen HTML/JSON de Playwright junto a sus capturas, y el resumen textual/JUnit de cada suite en la misma corrida.

## Próximas evidencias que completarían el capítulo

1. Ejecutar las suites con una versión y commit identificados y conservar salida JUnit/JSON fechada por componente.
2. Revisar los seis fallos E2E de rectorado; guardar el resultado posterior con navegador, versión y causa/corrección asociada.
3. Portar a los cubos académicos las 14 clases IT de OLAP excluidas, para recuperar la cobertura de integración de la API de consultas.
4. Repetir PRED-008 después de corregir/verificar disponibilidad de inferencia y fijar concurrencia, duración, volumen, recursos y umbrales antes de medir.
5. Planificar una prueba de aceptación con usuarios institucionales, tareas por perfil, consentimiento/autorización y métricas acordadas.

**Fuente de elaboración del corte histórico del 11/11:** inventario local del repositorio; `docs/dw/hop-req-6-progress.md`; `docs/prediction/evidence/PRED-004-synthetic-comparison.json`; artefactos locales PRED-008 y capturas Playwright de rectorado. Esa revisión no ejecutó ni modificó las suites.

## Registro que debe completarse en la siguiente corrida

Para que los resultados puedan incorporarse a la memoria y repetirse por otra persona, cada ejecución nueva debe registrar los siguientes datos. El SHA del commit, el comando completo y los archivos de evidencia deben corresponder a la misma corrida.

| Campo del registro | Información a guardar |
|---|---|
| Identificador | ID único de la ejecución o del caso, relacionado con el requisito que verifica. |
| Componente y alcance | Servicio, biblioteca, portal o flujo y comportamiento cubierto. |
| Versión | SHA del commit evaluado y, cuando corresponda, versión de dependencias/imagen. |
| Condiciones | Fecha, ambiente, configuración, servicios requeridos y tipo de datos (fixture sintético o fuente institucional autorizada). |
| Procedimiento | Comando exacto y pasos manuales necesarios para repetir el caso. |
| Criterio | Resultado esperado, definido antes de ejecutar la prueba. |
| Resultado | Conteo aprobado/fallido/omitido/error; resultado obtenido y breve explicación de desviaciones. |
| Evidencia | Ruta al log, reporte JUnit/JSON, reporte Playwright y capturas asociadas. |
| Seguimiento | Incidencia relacionada, corrección aplicada y resultado de la repetición, si corresponde. |

### Relación sugerida con la sección 3.6 del proyecto

| Apartado | Evidencia que debe aparecer o enlazarse |
|---|---|
| 3.6.1–3.6.2 Plan, criterios, datos y ambiente | Criterios previos, versión evaluada, configuración y procedimiento reproducible. |
| 3.6.3–3.6.7 Unitarias, integración, DW, portales y seguridad | Casos ejecutados por componente, conteos y logs/reportes correspondientes. |
| 3.6.8 Pipeline predictivo | Suites del pipeline separadas del experimento de modelos; indicar si los datos son sintéticos o institucionales. |
| 3.6.9–3.6.10 Rendimiento y usabilidad | Mediciones con umbrales acordados y evaluación con participantes; si no se ejecutaron, mantener estado pendiente. |
| 3.6.11–3.6.12 Incidencias y matriz | Fallos, correcciones, repetición, estado final y enlace a cada evidencia. |

Los logs de la corrida del 11/11/2026 permanecen en el directorio local temporal `.tmp` y no se versionan con este documento. Para la siguiente corrida, conservar los reportes relevantes en una ubicación estable y autorizada, sin incluir credenciales ni datos personales. Las capturas de interfaz complementan los logs; no los sustituyen. Si se incorporan al documento académico, actualizar el índice de figuras y anexos que corresponda.

