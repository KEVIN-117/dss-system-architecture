# Prediction Service & Training Worker

Servicio HTTP basado en FastAPI y worker de entrenamiento aislado basado en Celery con RabbitMQ, diseñado conforme al ADR-PRED-001 (CRISP-DM, RNF-09).

## Arquitectura de contenedores

El servicio está desacoplado en dos imágenes Docker independientes para garantizar el aislamiento de recursos y evitar la degradación de inferencias durante el entrenamiento intensivo:

1. **`prediction-service` (API):** Contenedor ligero FastAPI para health checks, inferencias y control de trabajos asíncronos (`Dockerfile`).
2. **`prediction-worker` (Worker ML):** Contenedor Celery aislado con librerías de ML (`scikit-learn`, `xgboost`, `imbalanced-learn`, `pandas`, `numpy`, `joblib`) para preparación, balanceo y entrenamiento de modelos (`Dockerfile.worker`).

Los trabajos y el outbox transaccional viven en PostgreSQL, en `ml_workspace`; RabbitMQ solo transporta tareas. API y worker usan la misma base de desarrollo. El volumen `prediction_artifacts` contiene únicamente artefactos candidatos. En despliegues reales se debe configurar una identidad SQL de mínimo privilegio, separada de la cuenta administrativa usada por el Compose local.

```
                      +-------------------+
                      |   RabbitMQ 4.3    |
                      +-------------------+
                                ^
                     AMQP tasks |
                                v
+----------------------+                 +----------------------+
|  prediction-service  |                 |  prediction-worker   |
|     (FastAPI API)    |                 |   (Celery + ML)      |
+----------------------+                 +----------------------+
           |                                        |
           +------------> [ PostgreSQL · ml_workspace ] <+
                          - training_job
                          - training_job_outbox
           +------------> [ prediction_artifacts ] <+
                          - /{job_id}-attempt-{n}/
```

## Configuración

### Variables de la API

| Variable | Default local | Descripción |
| --- | --- | --- |
| `PREDICTION_ENV` | `development` | Entorno de ejecución: `development`, `test` o `production`. |
| `PREDICTION_HOST` | `0.0.0.0` | Interfaz donde escucha Uvicorn. |
| `PREDICTION_PORT` | `8000` | Puerto HTTP, entre 1 y 65535. |
| `PREDICTION_LOG_LEVEL` | `info` | Nivel de logging de Uvicorn. |
| `PREDICTION_RELOAD` | `false` | Recarga automática para desarrollo (rechazada en producción). |
| `PREDICTION_DATABASE_URL` | PostgreSQL Compose local | Base compartida para estado de trabajos y outbox transaccional. |
| `PREDICTION_IDEMPOTENCY_SCOPE` | `development` | Ámbito que delimita las claves de idempotencia. |
| `PREDICTION_DATASET_ROOT` | `/app/snapshots` | Raíz de solo lectura para snapshots preparados por operadores (`custom/` se usa como respaldo de solo lectura). |
| `PREDICTION_CUSTOM_DATASET_ROOT` | `/app/custom-datasets` | Almacén compartido de datasets subidos: lectura-escritura en la API, solo lectura en el worker (volumen `prediction_custom_datasets`). |
| `PREDICTION_EXTRACTED_DATASET_ROOT` | `/app/extracted-datasets` | Datasets extraídos del DW por el worker (PRED-102): lectura-escritura en el worker, solo lectura en la API (volumen `prediction_extracted_datasets`). Sin esta variable la API rechaza las extracciones con `503`. |
| `PREDICTION_DATASET_UPLOAD_MAX_BYTES` | `52428800` | Tamaño máximo del `.zip` subido; se rechaza con `413` sin cargarlo completo en memoria. |
| `PREDICTION_DATASET_MAX_UNCOMPRESSED_BYTES` | `209715200` | Tamaño máximo descomprimido de `manifest.json` + `rows.jsonl` (protección contra zip bombs). |
| `PREDICTION_CONFIG_ROOT` | `/app/configurations` (worker) | Catálogo de configuraciones versionadas; Compose lo monta en solo lectura. |
| `PREDICTION_OUTBOX_POLL_SECONDS` | `5` | Intervalo de recuperación de mensajes pendientes en outbox. |
| `PREDICTION_MAX_QUEUED_JOBS` | `4` | Jobs en cola (entrenamiento y extracción) admitidos además de `WORKER_MAX_CONCURRENT_JOBS` en ejecución; al superarse responde `429 JOB_CAPACITY`. |
| `PREDICTION_DW_DATABASE_URL` | *(sin configurar)* | Conexión de solo lectura al DW para resolver cortes y features. Sin DSN, la inferencia falla cerrada. |
| `KEYCLOAK_URL` | *(sin configurar)* | URL base del issuer Keycloak. |
| `KEYCLOAK_REALM` | *(sin configurar)* | Realm usado para validar firma e issuer del bearer token. |
| `KEYCLOAK_AUDIENCE` | *(sin configurar)* | Audience requerido en el access token. |
| `KEYCLOAK_PERMISSIONS_CLIENT_ID` | `dss-permissions` | Cliente catálogo cuyos roles son los permisos (`analytics:*`, `prediction:publish`, `prediction:train`). |
| `KEYCLOAK_ISSUER_URI` | Derivado de URL + realm | Emisor exacto que debe coincidir con el claim `iss`; admite hostname externo distinto. |
| `KEYCLOAK_JWKS_URL` | Derivado del issuer | URL para descargar claves de firma; permite hostname interno del contenedor. |
| `AUTH_SERVICE_URL` | `http://auth-service:8000` | Servicio que devuelve el perfil activo y sus `academicContexts` confiables. |

### Variables del Worker y Broker

| Variable | Default local | Descripción |
| --- | --- | --- |
| `RABBITMQ_HOST` | `rabbitmq` | Host del broker RabbitMQ. |
| `RABBITMQ_PORT` | `5672` | Puerto AMQP de RabbitMQ. |
| `RABBITMQ_USERNAME` | Usuario definido en Compose local | Usuario de autenticación RabbitMQ. |
| `RABBITMQ_PASSWORD` | Valor local configurado en `.env` | Contraseña de RabbitMQ; mantener secretos fuera del repositorio. |
| `RABBITMQ_VHOST` | `/` | Virtual host en RabbitMQ. |
| `CELERY_BROKER_URL` | *(calculada)* | URL AMQP completa (`amqp://user:pass@host:port/vhost`). |
| `WORKER_MAX_CONCURRENT_JOBS` | `1` | Límite explícito de concurrencia de entrenamiento. |
| `WORKER_JOB_TIMEOUT_SECONDS` | `1800` | Tiempo límite por trabajo (30 minutos por defecto). |
| `WORKER_CPU_LIMIT` | `2` | Hilos/CPU máximos del estimador y cuota dura del contenedor. |
| `WORKER_MEMORY_LIMIT_MB` | `2048` | Límite duro de memoria del contenedor en Compose. |
| `WORKER_ARTIFACTS_DIR` | `/app/artifacts` | Ruta del volumen para persistencia de artefactos. |
| `PREDICTION_DW_DATABASE_URL` | *(sin configurar)* | Conexión de solo lectura al DW requerida también por el worker para resolver la población y sus features, y para las extracciones de datasets (PRED-102). |
| `WORKER_RANDOM_SEED` | `42` | Semilla por defecto para reproducibilidad. |
| `WORKER_MAX_JOB_ATTEMPTS` | `3` | Claims máximos por job o lote. Cuando el último intento muere (lease vencida), se marca `FAILED` con `ATTEMPTS_EXHAUSTED` en vez de reintentarse indefinidamente. |

La migración `0066` (PRED-102) añade `job_kind`, `params` y `result_ref` a `ml_workspace.training_job`; el algoritmo solo se restringe a `random_forest`/`xgboost` en los jobs `TRAIN`. Las extracciones usan la cola `prediction.train_model` (tarea `prediction.extract_dataset`) y la misma admisión de capacidad que el entrenamiento. Las migraciones `0026` y `0027` crean el registro, el outbox y el grupo SQL `dw_prediction_runtime`, con acceso únicamente a esas tablas. Para entornos fuera de desarrollo, provisionar logins independientes para API/worker y asignarles ese grupo; no usar `dw_ml_writer` para el API. El API inserta job y outbox en una transacción; si falla el broker, el sondeo periódico vuelve a publicar el outbox con backoff exponencial. La entrega es al menos una vez: Celery usa `job_id` como identificador estable y el worker reclama el registro con una lease atómica. PostgreSQL es la fuente de estado y resultados, por eso Celery no usa backend RPC ni colas temporales de control/mingle. Si el worker cae, el reintento espera a que expire la lease y escribe en un directorio de artefactos por intento.

Cada claim incrementa `attempt`, que actúa como token de fencing: el resultado final (`SUCCEEDED`, `FAILED` o `PUBLISHED`) solo se escribe si la fila sigue `RUNNING` con ese mismo intento. Un worker cuya lease venció y fue reemplazado no puede sobrescribir al intento nuevo; su artefacto queda como candidato huérfano. La migración `0036` añade `attempt` a `ml_workspace.prediction_batch`.

En Compose, `prediction-worker` consume solo `prediction.train_model` y `prediction-publisher` solo `prediction.publish_population` (con artefactos en solo lectura), para que un entrenamiento largo no bloquee el scoring poblacional. La imagen del worker sin `command` sigue consumiendo ambas colas.

El API recibe solo `configuration_ref`. El worker resuelve `<configuration_ref>.json` dentro del catálogo de solo lectura y registra la referencia y el digest de su contenido. El directorio local está en `infra/prediction-configurations/`; sus JSON no se versionan. Una política institucional requiere aprobación y costes DSA válidos; los valores no se envían directamente en una petición.

## Autorización (IAM-013)

Los permisos vienen del token (`resource_access.dss-permissions.roles`) y se gestionan desde el admin-portal:

| Permiso | Permite |
|---|---|
| `analytics:read` + `analytics:global` | Leer predicciones de toda la institución. |
| `analytics:read` + `analytics:faculty` | Leer predicciones de las facultades de sus contextos de facultad. |
| `analytics:read` + `analytics:career` | Leer predicciones de las carreras de sus contextos de carrera. |
| `prediction:publish` | Iniciar el scoring poblacional, siempre dentro del alcance anterior. |
| `prediction:train` | Entrenar modelos y gestionar datasets y modelos. |

El alcance es la **unión** de todos los contextos académicos que devuelve auth-service (IAM-009) y de todos los permisos de alcance: por ejemplo, un decano interino con dos facultades ve ambas, y un usuario con `analytics:faculty` y `analytics:career` ve su facultad y además su carrera de otra facultad. SUPERADMIN no tiene permisos `analytics:*` y, por lo tanto, no tiene acceso académico.

Las listas de roles de la convivencia (`PREDICTION_ALLOWED_ROLES`, `PREDICTION_BATCH_SUBMITTER_ROLES`, `PREDICTION_TRAINING_ROLES`, `PREDICTION_LEGACY_ROLES_ENABLED` y `KEYCLOAK_ROLE_CLIENT_ID`) se retiraron en IAM-019 y se ignoran. SUPERADMIN incluye `prediction:train`; ningún rol incluye `prediction:publish`, que se asigna por usuario desde el admin-portal.

## Endpoints de la API

- `GET /`: Health check básico del servicio.
- `POST /predict`: ruta heredada deshabilitada para scoring. Devuelve `503` si no hay modelo aprobado; con uno activo informa que falta el adaptador confiable de features DW. Nunca fabrica una predicción ni acepta features del cliente como datos institucionales.
- `POST /v1/predictions`: inferencia puntual para cualquier tarea servible del catálogo. Eventos por estudiante: `program_dropout`, `student_backlog`, `student_gpa`. Eventos por matrícula (requieren `course_ref`): `course_abandonment`, `course_failure`, `course_final_grade`. Las tareas de clasificación devuelven `predicted_class` y `event_probability`; las de regresión devuelven `predicted_value`, `prediction_interval` (`{"0.8": {"lower", "upper"}, "0.95": {...}}`) y `unit`, con `task_kind` indicando cuál aplica. Requiere bearer JWT, estudiante/programa/corte y bundle aprobado para el evento y cadencia correspondientes. La población abarca los tres primeros años académicos (tres cortes anuales o seis semestrales). El cliente no puede enviar features.
- `POST /v1/prediction-batches`: crea un lote asíncrono para programa/corte de una tarea por estudiante (`event_type`: `program_dropout` por defecto, `student_backlog` o `student_gpa`), con idempotencia y modelo aprobado fijado al aceptar el trabajo. Requiere el permiso `prediction:publish` y, además, ámbito académico sobre el programa.
- `GET /v1/prediction-batches/{batch_id}`: consulta estado e historial; devuelve filas únicamente tras `PUBLISHED` y si el solicitante conserva ámbito para el programa/corte.
- `GET /v1/prediction-publications?program_ref=…&cut_id=…&event_type=…`: obtiene la publicación completa vigente del evento (por defecto `program_dropout`); devuelve `publication: null` si aún no existe. Los lotes históricos se consultan por `batch_id`.
- `GET /v1/academic-options`: devuelve programas activos y cierres procesados visibles para el usuario autenticado; filtra las opciones por permisos y ámbito académico.
- `POST /v1/training-jobs`: Solicita un trabajo asíncrono de entrenamiento. `algorithm` debe ser uno de los algoritmos de la tarea del dataset (`random_forest`/`xgboost` en clasificación; además `ridge` en regresión). `search_space` opcional: grilla por algoritmo con parámetros permitidos y rangos validados (máximo 10 valores por parámetro y 64 combinaciones). Requiere header `Idempotency-Key`.
- `POST /v1/training-studies`: crea un job `TRAIN` por algoritmo (`algorithms[]`, con `search_spaces` opcionales por algoritmo) sobre el mismo dataset y partición, agrupados por `study_id` para compararlos. La `Idempotency-Key` cubre el estudio; `GET /v1/jobs?study_id=…` lista sus jobs. Retorna `202 Accepted` con `job_id` y estado `QUEUED`. La clave de idempotencia queda acotada al `sub` del operador y `submitted_by` registra ese `sub` verificado.
- `GET /v1/training-jobs/{jobId}`: Consulta el estado, progreso, candidato generado o detalle de error según el estándar RFC 7807 Problem Details.
- `POST /v1/training-jobs/{jobId}/cancel`: cancela un job `QUEUED` (`200`). Un job que ya está en ejecución o terminado responde `409 JOB_NOT_CANCELLABLE`; no se interrumpe un entrenamiento en curso.
- `GET /v1/ml-tasks`: catálogo de tareas de predicción (`ml_tasks/`): tipo, grano, algoritmos, cadencias, clases y referencias de objetivo y población. Requiere `prediction:train`.
- `POST /v1/dataset-extractions` (PRED-102): encola un job `EXTRACT_DATASET`. Cuerpo: `task_code` (tarea extraíble del catálogo), `cadence`, `programs` (vacío = todos los programas de la cadencia), `horizon_years` (solo deserción) y `features` (vacío = todas). Requiere `Idempotency-Key`. El worker ejecuta la consulta point-in-time del contrato de features, valida el contrato de datos, calcula `profile.json` y publica el dataset de forma atómica como `custom:<dataset_id>`, que queda en `result_ref` del job. Responde `422` con el código del catálogo si la tarea o la cadencia no son válidas.
- `GET /v1/jobs?kind=&status=&limit=`: jobs de todos los operadores (`TRAIN`, `EXTRACT_DATASET`, `FORECAST`), del más reciente al más antiguo; reemplaza la lista guardada en el navegador.
- `GET /v1/jobs/{jobId}`: cualquier job, con `job_kind`, `params` y `result_ref`.
- `POST /v1/jobs/{jobId}/cancel`: cancela un job `QUEUED` o `RUNNING`. La cancelación de un job en ejecución es cooperativa: la fila pasa a `CANCELLED` de inmediato, las escrituras con fencing del worker fallan y el worker descarta el dataset o candidato parcial. `409 JOB_NOT_CANCELLABLE` si el job ya terminó.
- `GET /v1/datasets`: lista fixtures, datasets subidos y datasets extraídos.
- `POST /v1/forecast-jobs` (PRED-104): encola un job `FORECAST` (`prediction:train`). Cuerpo: `cadence`, `series_codes` (vacío = las tres series), `programs` (vacío = todos los de la cadencia) y `horizon` (1–8 cortes). Requiere `Idempotency-Key`.
- `GET /v1/forecasts?series=…&program_ref=…&cadence=…`: con `program_ref`, el último pronóstico del programa con historia, proyección y bandas, modelo elegido y backtest; sin él, el resumen del último pronóstico de cada programa. Requiere `prediction:train` o `prediction:forecast:read` (el permiso se crea en Keycloak con PRED-106).
- `GET /v1/datasets/{datasetRef}/profile`: perfil exploratorio (EDA) del dataset: filas por periodo y programa, distribución del objetivo y recomendación de SMOTE, faltantes, estadísticas e histogramas por variable, correlación con el objetivo y avisos (`POSSIBLE_LEAKAGE`, `HIGH_MISSING`, `CONSTANT_FEATURE`, `CLASS_IMBALANCE`, `FEW_ROWS`, `SINGLE_PERIOD`). Solo agregados. Los datasets anteriores a PRED-102 se perfilan al leerlos.
- `GET /v1/datasets/{datasetRef}/sample?limit=50`: primeras filas (máximo 200) con solo los campos declarados en el manifest; los estudiantes aparecen con su pseudónimo.
- `POST /v1/datasets/upload`: recibe un `.zip` con un único `manifest.json` y un único `rows.jsonl`, aplica límites de tamaño, valida el contrato y registra el dataset de forma **inmutable** (`409` si el `dataset_id` ya existe). Guarda `upload.json` con el `sub` del operador, la fecha y el SHA-256 del archivo, y `profile.json` con su perfil exploratorio. El worker lo resuelve como `custom:<dataset_id>`.

Los endpoints de entrenamiento, extracción, jobs y datasets validan el JWT de Keycloak dentro del propio servicio (no dependen solo del BFF) y exigen el permiso `prediction:train`: `401` sin token válido, `403` sin el permiso.

## Contrato de features (paridad entrenamiento/servicio)

`feature_contract.py` es la única definición de cómo se calcula cada predictor a partir del DW en un corte procesado: la expresión SQL de cada feature, una única consulta *point-in-time* por evento (todo filtrado por `effective_at` del corte) y la regla de elegibilidad (primeros tres años académicos, cadencia única, fecha de inscripción confiable). La usan los dos lados:

- **Entrenamiento:** `python -m training.dw_extract --program <id> --cadence ANUAL|SEMESTRAL --output <dir>` ejecuta la consulta para cada cierre procesado del programa, aplica la regla de elegibilidad, seudonimiza al estudiante con una clave descartada y escribe `manifest.json` + `rows.jsonl` en el contrato `prepared-dataset-v1`, con `feature_contract` (versión, evento, digest y features). Las referencias de objetivo y población salen del catálogo de tareas (`catalog:<TAREA>:…`); no se requiere aprobación DSA. El directorio de salida puede ser `/app/custom-datasets/<uuid>` para entrenar con `custom:<uuid>`.
- **Servicio:** `DwPredictionDataProvider` ejecuta la misma consulta: una fila para `/v1/predictions` y la población completa en **una sola consulta** para el scoring por lotes (antes eran dos consultas por estudiante).

El digest del contrato cubre definiciones, texto SQL y versión de la regla de elegibilidad. El contrato de datasets rechaza un `feature_contract` distinto del vigente (`FEATURE_CONTRACT_MISMATCH`) y bloquea datasets institucionales sin él (`FEATURE_CONTRACT_MISSING`; los fixtures sintéticos están exentos). El worker copia el contrato al manifest del bundle (incluido en `artifact_digest`) y el servicio responde `503 INCOMPATIBLE_SCHEMA` ante un bundle sin contrato o con un digest distinto. Cambiar cómo se calcula una feature obliga a re-extraer y reentrenar en lugar de producir una diferencia silenciosa.

`tests/integration/feature_parity_check.py` compara, contra un DW real y en solo lectura, las filas del extractor con lo que devuelve el servicio para los mismos estudiantes. Solo imprime conteos agregados.

El abandono de materia usa el mismo catálogo para servir, pero su extractor de entrenamiento todavía no existe; esos modelos siguen entrenándose con `scripts/run_pred006_faker_experiments.py`.

## Objetivos de predicción (PRED-103)

| Tarea | Tipo | Grano | Objetivo | Consulta point-in-time |
|---|---|---|---|---|
| `PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE` | clasificación | estudiante × programa × corte | deserción en el siguiente corte (o sin retorno en el horizonte) | `program_dropout` |
| `STUDENT_BACKLOG_NEXT_CUT` | clasificación | estudiante × programa × corte | `RISK` si `materias_arrastradas` sube en el siguiente corte | la de deserción, sin cambios |
| `STUDENT_GPA_NEXT_CUT` | regresión | estudiante × programa × corte | `ppa_acumulado` del siguiente corte | la de deserción, sin cambios |
| `COURSE_FAILURE` | clasificación | estudiante × materia × corte | `RISK` si la materia se reprueba o abandona | `course_failure` |
| `COURSE_FINAL_GRADE` | regresión | estudiante × materia × corte | `nota_final` de la inscripción | `course_failure` |

- **Deserción intacta.** Las tareas por estudiante reutilizan la consulta y la regla de elegibilidad de deserción sin modificarlas, así que el digest del contrato de deserción no cambia y los modelos activos siguen sirviendo. Cada evento tiene su propio digest, por lo que un bundle no puede servir otro evento.
- **Etiquetas de siguiente corte** (`training/student_extract.py`). La etiqueta es la fila del mismo estudiante en el siguiente corte de la cadencia, que la extracción ya consulta. Se excluyen y reportan las filas cuyo siguiente corte aún no está procesado (`NEXT_CUT_NOT_OBSERVED`) o donde el estudiante no aparece (`ABSENT_NEXT_CUT`: eso es una pregunta de deserción). La columna de la que sale la etiqueta (`materias_arrastradas` o `ppa_acumulado`) es obligatoria como feature, y el perfil no la marca como fuga.
- **Consulta de materia.** `course_failure` agrega `nota_final` como columna de auditoría (nunca como feature) y los filtros opcionales `%(subject)s`/`%(course)s` para servir una sola inscripción. Esto cambia el digest de `COURSE_FAILURE`, que no tenía ruta de servicio.
- **Contrato de datos por evento.** `dataset_contract.py` valida con el contrato de retención solo la deserción; las demás tareas usan una ruta por evento con su grano (`student_program_academic_cut` o `student_course_academic_period`), clases o un objetivo numérico finito con al menos dos valores distintos. Corrige además que las extracciones de `COURSE_FAILURE` de PRED-102 siempre fallaran con el contrato de retención.
- **Regresión** (`training/regression_trainer.py`). Algoritmos `ridge` (con escalado dentro del modelo), `random_forest` y `xgboost`. La partición externa es la misma temporal con estudiantes disjuntos; el ajuste usa `GroupKFold` por estudiante, nunca SMOTE, y elige por RMSE out-of-fold y luego MAE. Las métricas del test (`evaluation/metrics.py::regression_metrics`) son MAE, RMSE, R², MAPE, sesgo y residuos por tramo del valor observado. Los intervalos del 80 % y 95 % salen de cuantiles de los residuos out-of-fold del candidato elegido; el test reporta su cobertura real (`interval_coverage`).
- **Comparación.** `evaluation.comparison` acepta dos o más candidatos del mismo tipo y la misma partición: clasificación por recall/F1 (o costo) de validación, regresión por RMSE/MAE de validación.
- **Publicaciones.** La migración `0067` habilita lotes de `STUDENT_BACKLOG_NEXT_CUT` y `STUDENT_GPA_NEXT_CUT`, el algoritmo `ridge` en los jobs de entrenamiento y las columnas `predicted_value`/`prediction_interval` (cada fila lleva clase o valor, nunca ambos). La publicación vigente se consulta por evento.

## Pronósticos de postulaciones y matrícula (PRED-104)

| Serie | Fuente | Valor por programa y corte |
|---|---|---|
| `APPLICATIONS_BY_PROGRAM` | `dw.fact_admision` | postulaciones |
| `ADMITTED_BY_PROGRAM` | `dw.fact_admision` | postulantes con `es_admitido` |
| `ENROLLED_BY_PROGRAM` | `dw.fact_retencion_desercion` | estudiantes distintos (`id_alumno`) con materias cursadas |

- **Solo periodos cerrados** (`forecasting/series_extract.py`): un corte entra cuando su cierre está `PROCESADO` y sus filas vienen de una ejecución ETL `EXITOSA`. La serie de cada programa va desde su primer corte observado hasta el último corte procesado de la cadencia; los cortes intermedios sin registros valen 0. Los programas deben tener el régimen de la cadencia pedida.
- **Modelos** (`forecasting/models.py`): `linear_trend` (mínimos cuadrados sobre tendencia y, en semestral, un indicador del 2.º periodo), `linear_trend_lag` (agrega el valor anterior; el pronóstico multi-paso es recursivo) y `seasonal_naive` (mismo periodo del ciclo anterior) como respaldo para series cortas. Los valores y límites inferiores nunca bajan de 0.
- **Selección por backtesting** (`forecasting/backtest.py`): en cada origen k el modelo se ajusta solo con los puntos anteriores a k y se evalúa en los siguientes, sin fuga. Gana el MAE más bajo; ante una diferencia menor al 1 % se prefiere el modelo más simple. El backtest reporta MAE, RMSE, MAPE, sesgo, MAE por horizonte y la cobertura real de las bandas.
- **Bandas del 80 % y 95 %**: cuantiles empíricos de los residuos dentro de la muestra del modelo ajustado, ensanchados por √h.
- **Persistencia** (migración `0068`): `ml_workspace.forecast_run` (modelo, selección y backtest por serie, programa y job) y `ml_workspace.forecast_point` (historia y proyección con bandas). El pronóstico publicado de una serie y programa es su última corrida; un job guarda todas sus corridas en una sola transacción y, si se cancela, no deja ninguna. No se usa el registro de modelos: el ajuste lineal es determinista y se recalcula en cada job.

## Pipeline de Preparación y Modelado

- **Partición temporal y agrupamiento:** `temporal_student_grouped_split` reserva un bloque global de periodos futuros para test, excluye el historial de estudiantes del test del train y comprueba que no haya solapamiento.
- **Imputación y preprocesamiento:** Imputación por mediana ajustada **exclusivamente con datos de entrenamiento**.
- **Balanceo SMOTE:** `apply_smote_if_warranted` evalúa el ratio de desbalance y aplica `SMOTE` o `SMOTENC` **únicamente sobre el fold de entrenamiento**. Test y validación permanecen con su distribución observada real.
- **Umbral de servicio:** el `decision_threshold` elegido en validación se guarda en el manifest, forma parte del `artifact_digest` y debe coincidir con el de `metrics.json`. La inferencia clasifica con `event_probability >= decision_threshold`; los bundles anteriores sin umbral conservan `model.predict()`.
- **Selección de hiperparámetros y umbral:** `StratifiedGroupKFold` agrupa por estudiante dentro del train temporal. Cada fold ajusta su propio preprocesador y sampler. El candidato se selecciona por recall medio y F1; para evidencia sintética el umbral descriptivo se deriva de validación por recall y F1. Para datasets institucionales no se abre el test sin una `decision_policy` aprobada con referencia y costes de FN/FP; con ella, modelo y umbral se seleccionan exclusivamente usando validación.
- **Métricas y comparación:** El reporte incluye precision, recall, F1 y soporte por clase, matriz de confusión etiquetada, promedios, exactitud complementaria y causas de métricas indefinidas. `evaluation.comparison` compara los artefactos RF/XGBoost si prueban la misma partición, dataset, objetivo y política; selecciona solo con validación y declara empate sin forzar un ganador. La decisión institucional permanece `EVIDENCIA_INSUFICIENTE` sin evidencia autorizada y criterios DSA.
- **Trazabilidad de artefactos:** Cada intento genera en `/artifacts/{job_id}-attempt-{n}/`:
  - `model.joblib`: Modelo entrenado.
  - `pipeline.joblib`: Pipeline de preprocesamiento serializado.
  - `manifest.json`: Manifiesto conforme al contrato `ModelManifest` con digest SHA-256.
  - `metrics.json`: Métricas de evaluación (Accuracy, Recall, Precision, F1, ROC-AUC, PR-AUC, matriz de confusión).
  - `training_config.json`: Hiperparámetros efectivos y configuración usada.
  - `balance_report.json`: Decisión y registro de la técnica de balanceo.
  - `dependency_lock.json`: Versiones exactas de Python y librerías ML.
  - `feature_names.json`: Lista ordenada de variables predictoras.
  - `evaluation_report.json`: Métricas y protocolo del holdout final asociados al `evaluation_ref`.

El `artifact_digest` identifica los hashes SHA-256 de **todos** los archivos del bundle y los metadatos inmutables (identidad, algoritmo, dataset, clases, esquema y definición de probabilidad). El loader verifica ruta dentro del workspace, integridad, contrato y versiones de runtime antes de deserializar. El puntero activo conserva además el hash del manifiesto aprobado. Modelos y preprocesadores se cargan como una única unidad inmutable; una petición consulta el puntero una vez y no puede mezclar versiones.

Los artefactos recién entrenados siempre quedan `CANDIDATE`. Un operador con `prediction:train` los activa desde el portal (`POST /v1/models/activate`) indicando un motivo; no se requiere aprobación DSA y solo la evidencia sintética queda bloqueada. Los eventos, cadencias y definiciones de objetivo y población salen del catálogo de tareas `ml_tasks/` (PRED-101). La promoción por CLI (`python -m training.model_registry`) sigue disponible y exige un reporte comparativo con decisión `APTO`, `deployment_allowed: true` y coincidencia exacta de `model_id`, versión, digest y dataset. El estado activo, el reporte aprobatorio y el historial viven en el volumen persistente compartido `prediction_artifacts`; ver [PRED-005 — Operación de modelos](../docs/prediction/PRED-005-operations.md) para activación, recuperación y rollback.

La inferencia institucional requiere configuración aprobada para Keycloak, Auth Service, roles académicos y `PREDICTION_DW_DATABASE_URL`. El servicio consulta el DW con transacciones de solo lectura; la migración `0031_prediction_inference_read_access.sql` crea el rol `dw_prediction_reader` y le otorga `SELECT` únicamente sobre las tablas de hechos, dimensiones y control necesarias. Mantén esta conexión separada de la conexión del job store, que usa `dw_prediction_runtime`. El endpoint permanece indisponible si faltan esos valores, no existe bundle aprobado, el esquema del modelo solicita una feature no permitida o no hay evidencia de `available_at_cut=true`. La lista de roles debe reflejar la decisión IAM/DSA; no se asigna un valor por defecto.

La migración `0034_prediction_publications.sql` crea `ml_workspace.prediction_batch`, su outbox y las filas de `prediction_result`. El lote y sus resultados pasan a `PUBLISHED` en una transacción; `v_published_prediction` oculta los demás estados. Las predicciones nunca se insertan en `fact_retencion_desercion` y las tablas no se otorgan a `dw_reader`, `dw_ml_writer` ni `dw_prediction_reader`. El API aplica permisos y ámbito antes de devolver resultados. Las recalculaciones crean lotes nuevos e inmutables; la consulta vigente selecciona el último lote publicado para el mismo programa/corte.

El worker comprueba que el modelo activo todavía coincida con el fijado al crear el lote. Si cambió antes de puntuar, falla el lote y debe enviarse una solicitud nueva. Mantén `prediction:publish` separado de los permisos de consulta: iniciar un scoring poblacional requiere asignación explícita de IAM/DSA. Configura el worker con `PREDICTION_DW_DATABASE_URL` de solo lectura y su conexión de publicación con los grants necesarios de `dw_prediction_runtime`.

Detalles de implementación, cobertura y pendientes de aprobación: [PRED-006 — Inferencia puntual](../docs/prediction/PRED-006-implementation.md).

La inferencia individual solo devuelve la respuesta y un `prediction_id` de correlación; no la guarda en el DW. La persistencia/publicación poblacional pertenece a PRED-007 y no debe mezclarse con los hechos observados. Para abandono de materia, `fact_cursado` aparece al procesar el período; se necesita una fuente de inscripción con disponibilidad al inicio del período antes de afirmar que el score es prospectivo.

El contenedor API instala las dependencias ML fijadas porque necesita cargar el estimador y el preprocesador serializados; el contenedor Worker continúa separado y añade las herramientas de entrenamiento. Por eso la imagen API aumenta respecto a la variante ligera anterior.

Para generar un reporte comparativo a partir de dos o más jobs completados, ejecutar `uv run python -m evaluation.comparison --output artifacts/pred004-comparison.json artifacts/<job-a> artifacts/<job-b> [...]`. El resultado registra la elección hecha con validación y muestra las métricas test sin usarlas para seleccionar.

## Ejecución de Pruebas

```bash
cd prediction-service
uv run python -m unittest discover tests
```

## CI/CD en GitHub Actions

`.github/workflows/prediction-service-ci-cd.yml` se activa para PR hacia `main`, cambios en `main` que afecten predicción y ejecución manual. Los filtros evitan ejecutar el flujo por cambios ajenos al servicio. El job de verificación usa una sola VM Linux, Python 3.14, dependencias fijadas por `uv.lock`, caché de `uv`, una suite unitaria y validación de Compose. Limita los hilos nativos a uno para evitar sobrecarga del runner. El smoke test con PostgreSQL/RabbitMQ queda opt-in y no se ejecuta en cada PR.

Después de pasar CI, los cambios que llegan a `main` publican las imágenes API y worker en GHCR, solo para `linux/amd64`, con tags del SHA y `latest`. La publicación usa el `GITHUB_TOKEN` con permiso `packages: write` y caché BuildKit separada para cada imagen; no requiere secretos adicionales del repositorio. En una instalación autorizada se puede seleccionar una versión inmutable con `PREDICTION_IMAGE_TAG=<commit-sha>`, descargar con `docker compose pull prediction-service prediction-worker` e iniciar esos servicios con `docker compose up -d --no-build prediction-service prediction-worker`.

Este CD entrega imágenes del servicio. No despliega automáticamente a un entorno institucional, entrena con datos institucionales ni promueve un modelo candidato a activo; esos pasos requieren un proceso operativo aprobado aparte.

### Integración local con Compose

Con `.env` de desarrollo configurado, iniciar solo las dependencias y servicios de predicción:

```powershell
docker compose up --build -d postgres-dw dw-migrator rabbitmq prediction-service prediction-worker
docker compose run --rm --no-deps -e PREDICTION_TEST_OPERATOR_TOKEN prediction-worker python /app/tests/integration/stack_smoke.py
```

`PREDICTION_TEST_OPERATOR_TOKEN` debe contener un access token con el permiso `prediction:train`; la API rechaza los envíos de entrenamiento sin él.

La prueba crea trabajos sintéticos y comprueba la ruta API → PostgreSQL/outbox → RabbitMQ → worker, el reintento del outbox, la recuperación de una lease vencida y el digest del artefacto. No usa datos institucionales.
