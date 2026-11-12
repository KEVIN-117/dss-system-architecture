# Reporte de pruebas del DSS

**Fecha de revisión de evidencias:** 11 de noviembre de 2026  
**Alcance:** repositorios locales del DSS y ejecución de pruebas del 11 de noviembre de 2026 sobre el árbol de trabajo disponible. No se identificó un commit limpio para atribuir estos resultados; la evidencia no equivale a aceptación institucional.

## Ejecución local del 11 de noviembre de 2026

Se ejecutaron suites de servicios, bibliotecas y portales. Docker estaba detenido al inicio; las pruebas del DW y el ciclo predictivo iniciaron proyectos temporales aislados y los retiraron al terminar. Los logs de esta sesión quedaron en `dss-monorepo/.tmp/doc36-test-logs` (directorio local temporal).

| Componente | Resultado |
|---|---|
| Auth Service | 157/157 aprobadas. |
| DW Control | 6/6 aprobadas. |
| Keycloak Webhook | 8/8 aprobadas. |
| ETL Load Manager (Go) | 25 casos aprobados; dos paquetes sin casos. |
| ETL Service (Maven) | Build exitoso; no hay casos definidos. |
| OLAP (suite predeterminada) | 2.808/2.815 aprobadas; 7 omitidas. |
| OLAP (perfil integración) | 67/135 aprobadas, 67 fallidas y 1 error. Varios casos recibieron HTTP 400 cuando esperaban 200. |
| Prediction Service (unitarias) | 112/112 aprobadas. |
| DW/Hop | Validación del proyecto, regresión de esquema, contrato de nueve fuentes, workflow vertical y publicación atómica aprobados con fixtures. |
| Prediction lifecycle smoke | Tres aserciones aprobadas: volumen compartido, persistencia del puntero/artefacto y recarga tras reiniciar API. |
| Vitest de aplicaciones | 180/186 aprobadas; 6 fallidas y 1 error no controlado (cuatro del proxy OLAP y dos del alcance GraphQL del BFF). |
| Vitest de bibliotecas | 47/47 aprobadas. |
| Playwright Chromium | 20/20 aprobadas: BFF 3, administración 3, Landing 4, Decanato 4, Dirección 3 y Rectorado 3. |

### Comandos por componente

Ejecutar los comandos Maven/Gradle/Go/Python desde la raíz de cada servicio indicada; los comandos Vitest y Playwright desde `dss-monorepo`.

```powershell
# Auth Service
cd auth-service; .\mvnw.cmd --batch-mode --no-transfer-progress test
# DW Control Service
cd dw-control-service; .\gradlew.bat test --rerun-tasks
# Keycloak Webhook
cd keycloak-webhook; mvn --batch-mode --no-transfer-progress verify
# ETL Load Manager
cd etl-layer\loadmanager; go test ./... -count=1 -v
# ETL Service
mvn --batch-mode --no-transfer-progress -f etl-service\pom.xml test
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

Las pruebas E2E excluyeron los dos casos de publicación predictiva que requieren cuentas/datos preaprovisionados y el workspace OLAP que requiere servicios autenticados. El alcance fue Chromium. PRED-008 no se reejecutó porque depende de sesiones autenticadas de Rectorado y Superadmin, además de un servicio de inferencia disponible. La evaluación de usabilidad institucional sigue pendiente. Los seis fallos de Vitest y la suite de integración OLAP deben diagnosticarse y repetirse.

Los estados descritos en el inventario siguiente representan lo encontrado antes de la corrida de esta fecha; esta sección añade los resultados de ejecución disponibles.
## Resumen ejecutivo

La verificación del DSS abarca pruebas unitarias y de componentes en Auth Service, DW Control, servicios de datos y portales; pruebas SQL y de integración del Data Warehouse; flujos E2E; experimentación del pipeline predictivo; y una prueba de carga exploratoria.

Se encontraron dos evidencias consolidadas de ejecución que pueden complementar la matriz del informe:

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
| ETL / Load Manager | Dominio, configuración, ejecución, registro de fuentes, handlers HTTP y adaptadores PostgreSQL; hay pruebas de integración y recuperación. | `etl-layer/loadmanager/**/` (`*_test.go`). | Código de prueba presente; no se atribuyen resultados sin log de ejecución. |
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
| Unitaria / componente | Numerosas suites identificadas en Java, Go, Python, TypeScript y SQL; no hay reporte consolidado de ejecución. | Reportar inventario, no porcentaje aprobado. Adjuntar salida fechada por suite en la siguiente corrida. |
| Integración DW | Req. 6: 9 manifiestos, 5 dimensiones, 3 hechos y 8 lotes; cierre `EXITOSA` descrito en el registro. | Ejecutada con fixtures sintéticos; no equivale a prueba productiva. |
| Calidad e integridad DW | Aserciones de rechazo de nota 101, transiciones SCD2, clasificación de retención, sellado/gates y publicación atómica. | Atribuibles al flujo de integración documentado y a pruebas transaccionales; conservar su alcance sintético. |
| Funcional / permisos | Specs para GraphQL, login, callback, contexto, conectores y portales; seis capturas de fallos E2E de rectorado. | No afirmar aceptación funcional integral; investigar y documentar esos fallos antes de cerrar el resultado E2E. |
| Pipeline ML | PRED-004, dos algoritmos, 30/10, tres folds, decisión `EVIDENCIA_INSUFICIENTE`. | Experimento sintético ejecutado; no seleccionar modelo ni autorizar despliegue. |
| Rendimiento | PRED-008 incompleto, umbrales ausentes, respuestas 502 en inferencia. | Caracterización exploratoria; repetir con servicio sano, carga acordada y criterios previos. |
| Usabilidad | Sin evidencia de sesiones con participantes institucionales. | Pendiente; no contabilizar como prueba ejecutada. |

## Evidencia visual y anexos

Las seis capturas de Playwright son candidatas a anexarse como evidencia de fallos, una por escenario/navegador. No se recomienda presentarlas como demostración de un recorrido satisfactorio. Para una versión final más sólida, exportar el resumen HTML/JSON de Playwright junto a sus capturas, y el resumen textual/JUnit de cada suite en la misma corrida.

## Próximas evidencias que completarían el capítulo

1. Ejecutar las suites con una versión y commit identificados y conservar salida JUnit/JSON fechada por componente.
2. Revisar los seis fallos E2E; guardar el resultado posterior con navegador, versión y causa/corrección asociada.
3. Repetir PRED-008 después de corregir/verificar disponibilidad de inferencia y fijar concurrencia, duración, volumen, recursos y umbrales antes de medir.
4. Planificar una prueba de aceptación con usuarios institucionales, tareas por perfil, consentimiento/autorización y métricas acordadas.

**Fuente de elaboración:** inventario local del repositorio al 11/11/2026; `docs/dw/hop-req-6-progress.md`; `docs/prediction/evidence/PRED-004-synthetic-comparison.json`; artefactos locales PRED-008 y capturas Playwright de rectorado. No se modificaron ni se reejecutaron las suites para crear este reporte.

