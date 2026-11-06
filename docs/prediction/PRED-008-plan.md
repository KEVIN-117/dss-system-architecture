# PRED-008 — Verificar aislamiento de recursos durante entrenamiento e inferencia

## Objetivo y alcance

Medir si la API predictiva, la consulta de lotes/publicaciones y el BFF/dashboard siguen respondiendo mientras el worker entrena Random Forest o XGBoost. Las corridas usan el fixture sintético `fixture:pred003_synthetic-v1` para entrenar y referencias Faker del DW local para probar inferencia/publicación. No son evidencia de rendimiento institucional ni de calidad predictiva.

El driver `prediction-service/tests/integration/prediction_load_test.py` ejecuta escenarios comparables de línea base y entrenamiento activo. Registra latencia p50/p95/máxima, respuestas y errores HTTP por endpoint, estadísticas Docker (CPU, RAM, I/O de bloque/red) y, cuando se configura un DSN read-only, sesiones activas/en espera de PostgreSQL. Los endpoints medidos son health, inferencia, publicación; opcionalmente fachada GraphQL del BFF y `/predictions`.

## Estado de decisiones de operación

RNF-09 requiere aislamiento, pero el proyecto no definió un SLA numérico de inferencia o UI. Por eso el modo predeterminado es `CHARACTERIZATION_ONLY`: obtiene línea base comparable sin declarar PASS/FAIL. La decisión `APTO` requiere que responsable de servicio/operación registre antes de la corrida exigible:

- Máximo de clientes y duración de cada ventana.
- Máxima regresión aceptable de p95 frente a su línea base.
- Máxima tasa de errores admitida por endpoint.
- Cualquier límite absoluto de latencia que la operación acuerde.
- Capacidad/versión del host Docker y límites de CPU/RAM configurados.

El modo `--enforce` requiere explícitamente `--max-p95-regression` y `--max-error-rate`. Esos parámetros deben proceder del acuerdo operativo; no se heredan del SLA OLAP. La primera ejecución de caracterización sirve para estimar la línea base y acordar los límites, no para cerrar los criterios de aceptación.

## Ejecución local

1. Levantar el DW Faker, RabbitMQ, BFF y dashboard locales. Configurar una cuenta SUPERADMIN de pruebas con contraseña permanente y perfil activo en Auth Service en `dss-monorepo/apps/admin-portal-e2e/.env.e2e`, usando las claves de `PREDICTION_LOAD_SUPERADMIN_*` del archivo de ejemplo.
2. Ejecutar desde `dss-monorepo`; el runner inicia Chromium con Playwright, autentica la cuenta contra Keycloak/BFF, confirma el rol mediante `/api/auth/me` y mantiene la cookie solo en memoria/proceso. Luego el wrapper prepara un bundle de inferencia test-only en un volumen privado del proyecto Compose efímero, verifica que el `subject_ref` pertenece a la población de programa/corte, enruta el servicio aislado en `localhost:18007`, prueba la carga y elimina el volumen al terminar:

   ```powershell
   bun run prediction:load:e2e -- --program-ref ADM --cut-id 79 --subject-ref 6377 `
     --duration-seconds 10 --clients 2 --inject-worker-crash
   ```

   No se copia ni se guarda una cookie manualmente. Si `prediction-service` local ocupaba `localhost:18007`, el wrapper lo detiene temporalmente y lo restaura en `finally`; su volumen compartido no se modifica. Los recursos Docker, `pg_stat_activity` read-only, errores estructurados, p50/p95, RF/XGBoost y la recuperación del worker del proyecto efímero quedan en `prediction-service/.test-tmp/PRED-008-isolated-load-report.json`.
3. El wrapper usa los límites de desarrollo del Compose y obtiene la DSN host-local read-only desde `.env` cuando está disponible. No activa `--enforce`: primero hay que acordar con operaciones las regresiones p95 y la tasa de error aceptable.
4. Después del acuerdo operativo, ejecutar el driver en modo exigible sobre el mismo wrapper, manteniendo límites, población y versión de workload:

   ```powershell
   bun run prediction:load:e2e -- --program-ref ADM --cut-id 79 --subject-ref 6377 `
     --duration-seconds 60 --clients 2 --inject-worker-crash --enforce `
     --max-p95-regression <umbral-acordado> --max-error-rate <umbral-acordado>
   ```

   Los valores de 60 segundos y 2 clientes son de ejemplo; `--enforce` requiere umbrales explícitos acordados por operación. La corrida de caracterización ya incluye `--inject-worker-crash`, dirigido solo al worker desechable del proyecto y no al worker compartido.

El driver bloquea `PREDICTION_ENV=production`, exige `-ConfirmDevelopment`, limita clientes a 16 y trabajos sintéticos por algoritmo a 100, usa un dataset fixture fijo y no imprime token/DSN ni escribe identificadores del estudiante en el informe. Playwright requiere cuentas locales separadas: `SUPERADMIN` para entrenamientos y `RECTOR` para inferencia/publicación académicas. Configura `PREDICTION_LOAD_SUPERADMIN_USERNAME/PASSWORD` en `apps/admin-portal-e2e/.env.e2e` y `PREDICTION_E2E_RECTOR_USERNAME/PASSWORD` en `apps/rector-dashboard-e2e/.env.e2e`. Los bundles se mantienen en el volumen efímero.

### Preflight local — 2026-11-05

Se comprobó la disponibilidad previa de la pila de desarrollo: Prediction API (`localhost:18007`), health del BFF (`localhost:3006/api/health`) y dashboard (`localhost:3004/predictions`) respondieron HTTP 200. El DSN `PREDICTION_DW_DATABASE_URL` del `.env`, usando el login `prediction_dw_reader` y la publicación local del puerto DW `5434`, permitió una consulta de solo lectura. El login no es superusuario ni puede crear bases; tiene `SELECT` y no `INSERT` sobre `dw.fact_retencion_desercion`.

La configuración del worker observada fue concurrencia `1`, CPU `2`, memoria `2048 MB` y timeout `1800 s`. La muestra ociosa de Docker fue API `118.9 MiB`, worker `188.3 MiB`, DW `50.76 MiB` y RabbitMQ `171.7 MiB`; es solo una lectura instantánea previa, no caracteriza carga ni constituye un umbral operativo. El wrapper carga el DSN read-only desde `.env`, transforma `postgres-dw:5432` a `localhost:5434`, y valida por separado las sesiones académica y SUPERADMIN sin imprimir cookies ni perfiles.

**Este preflight no equivale a la prueba de carga.** Aún faltan las ventanas de referencia y entrenamiento concurrente RF/XGBoost, la caída controlada con tráfico, la medición de latencia/errores/recursos y el informe. Playwright obtiene sesiones nuevas para ambas cuentas. La evaluación exigible seguirá bloqueada hasta que operación acuerde los umbrales p95 y de error.

### Revisión de Operaciones ML y diagnóstico de entrenamiento — 2026-11-05

La página `/ml-operations` está autenticada y pudo consultar trabajos protegidos por el guard SUPERADMIN del BFF. El historial mostraba un Random Forest `SUCCEEDED` con `fixture:pred003_synthetic-v1` y un XGBoost `FAILED` con `fixture:pred002_synthetic-v1`. El log del worker identifica la causa del segundo: el contrato del fixture PRED-002 devuelve `BLOCKED`, por lo que falló antes de entrenar XGBoost. Logs previos registran XGBoost `SUCCEEDED` con PRED-003. Se retiró PRED-002 del selector para que la UI ofrezca solo el dataset sintético actualmente preparado.

El intento de carga PRED-008 con cookie manual pasó el preflight, pero el BFF devolvió HTTP 401 al enviar el trabajo; la solicitud no llegó a la API y no se generó informe válido. Para eliminar la copia manual y obtener una sesión nueva por ejecución se agregó `run_prediction_load_playwright.mjs`. Este realiza login OIDC, verifica `/api/auth/me` y `SUPERADMIN`, y pasa la cookie en memoria al wrapper hijo sin escribirla en archivos, argumentos o informes. El preflight PowerShell ahora usa el mismo `urllib` que emplea el generador de carga, y vuelve a comprobar sesión después de construir/preparar imágenes y antes del tráfico. El BFF tiene su propio TTL de sesión (5 minutos por defecto; máximo configurable 900 s), independiente del Access Token Lifespan de Keycloak; si la segunda comprobación indica vencimiento durante una build fría, usar `BFF_SESSION_TTL_SECONDS=900` en el `.env` local del BFF y reiniciarlo. La ejecución completa requiere credenciales SUPERADMIN de desarrollo en el `.env.e2e` ignorado.

En la última corrida compartida el 2026-11-05, las sesiones SUPERADMIN/RECTOR, la preparación del bundle de prueba y los trabajos RF/XGBoost terminaron. Health, publicación, GraphQL y dashboard respondieron `200`. La inferencia devolvió `502` en las ventanas de referencia, entrenamiento y caída; la revisión encontró que el validador del BFF rechazaba los campos de contexto presentes en el DTO de respuesta. El contrato y el validador del conector se alinearon, pero la corrección aún requiere una corrida integrada para confirmarse.

La misma corrida quedó `CHARACTERIZATION_ONLY (INCOMPLETE)`: Docker registró `RestartCount=0` para el worker y no se confirmó su recuperación. Compose eliminó correctamente el proyecto aislado y su volumen; el código de salida `1` vino del estado incompleto del escenario, no del apagado. El preparador ahora prevalida candidatos con el mismo `load_features` del endpoint, prefiere el ref solicitado y selecciona silenciosamente un perfil elegible alternativo cuando hace falta. El identificador elegido no se imprime en el informe.

No se acordaron umbrales operativos de p95/error y no se ejecutó una corrida `--enforce`. Por tanto, la evidencia disponible es una caracterización parcial; no acredita todavía todos los criterios de aceptación ni una decisión de capacidad `APTO`.

## Lectura del informe

- `results.<algorithm>.baseline` y `training_active`: latencia y tasa de respuesta por endpoint; inferencia registra el `model_id@version` observado sin incluir identidad del estudiante.
- `training_scenarios.<algorithm>.jobs`: trabajos sintéticos completados durante la ventana concurrente.
- `infrastructure_samples`: CPU/memoria/I/O de los contenedores que `docker compose ps` encuentre y actividad agregada de sesiones DW si se entregó DSN.
- `thresholds.status=NOT_SET_CHARACTERIZATION_ONLY`: no existe todavía una decisión de capacidad.
- `decision=PASS|FAIL`: solo se emite en modo de umbrales acordados y evalúa regresión p95/tasa de errores, límites Docker del worker y continuidad de la misma versión de modelo tras la caída.

Las sesiones activas/en espera y los contadores I/O son señales de contención, no una atribución causal por sí solas. Se deben interpretar junto con logs, límites efectivos y recursos del host. Las consultas DW del driver son read-only.

## Saturación y caída del worker

La corrida repite jobs RF/XGBoost durante toda la ventana, con el worker configurado en `WORKER_MAX_CONCURRENT_JOBS=1`, `WORKER_CPU_LIMIT=2` y `WORKER_MEMORY_LIMIT_MB=2048` por defecto. PRED-003 ya prueba límites de concurrencia y recuperación de leases; PRED-008 complementa eso con métricas bajo carga y una comprobación de límites efectivos Docker. La opción de caída controlada se ejecuta después de terminar los jobs del driver, detiene el worker ocioso con carga de API/BFF/UI y espera su reinicio automático. Usar solo un Compose local descartable y sin otros jobs; no detener el worker de un entorno compartido.

## Criterios y estado

| Criterio PRED-008 | Evidencia | Estado |
|---|---|---|
| Recursos, volumen, concurrencia y presupuestos acordados antes de prueba | Este plan y parámetros explícitos del driver | Umbrales p95/error pendientes de acuerdo operativo |
| Línea base vs RF y XGBoost | Escenarios repetibles, mismo workload | Ejecutado; informe de caracterización generado, sin umbrales de aprobación |
| API, analítica y UI disponibles durante entrenamiento | Health/inferencia/publicación; BFF y dashboard opcionales | Health/publicación/GraphQL/dashboard `200`; inferencia reportó `502`, con corrección de contrato pendiente de verificación |
| Saturación y caída controlada | Carga RF/XGBoost continua; opción `-InjectWorkerCrash` sobre el worker local sin jobs activos | Entrenamientos completados; reinicio del worker no confirmado (`RestartCount=0`) |
| CPU/RAM/concurrencia y contención DW/storage | Docker stats + `pg_stat_activity` read-only + evidencia de Compose | Se recopilaron muestras; falta analizar límites/contención con umbrales acordados |
| Comandos y resultados reproducibles | Script PowerShell, driver y reporte JSON | Implementados; última ejecución `INCOMPLETE`, artefacto local ignorado por Git |

Para completar la aceptación, repetir la corrida después de cargar la corrección del DTO, confirmar el reinicio del worker, acordar límites con Operaciones y ejecutar el modo `--enforce`. Si un límite falla, ajustar el aislamiento y repetir. El reporte local no se versiona; se debe adjuntar o resumir de forma sanitizada la evidencia final acordada.
