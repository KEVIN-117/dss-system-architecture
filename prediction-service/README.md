# Prediction Service & Training Worker

Servicio HTTP basado en FastAPI y worker de entrenamiento aislado basado en Celery con RabbitMQ, diseñado conforme al ADR-PRED-001 (CRISP-DM, RNF-09).

## Arquitectura de dos contenedores

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
| `PREDICTION_DATASET_ROOT` | `/app/snapshots` | Raíz de solo lectura para snapshots preparados. |
| `PREDICTION_OUTBOX_POLL_SECONDS` | `5` | Intervalo de recuperación de mensajes pendientes en outbox. |

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
| `WORKER_RANDOM_SEED` | `42` | Semilla por defecto para reproducibilidad. |

Las migraciones `0026` y `0027` crean el registro, el outbox y el grupo SQL `dw_prediction_runtime`, con acceso únicamente a esas tablas. Para entornos fuera de desarrollo, provisionar logins independientes para API/worker y asignarles ese grupo; no usar `dw_ml_writer` para el API. El API inserta job y outbox en una transacción; si falla el broker, el sondeo periódico vuelve a publicar el outbox con backoff exponencial. La entrega es al menos una vez: Celery usa `job_id` como identificador estable y el worker reclama el registro con una lease atómica. PostgreSQL es la fuente de estado y resultados, por eso Celery no usa backend RPC ni colas temporales de control/mingle. Si el worker cae, el reintento espera a que expire la lease y escribe en un directorio de artefactos por intento.

## Endpoints de la API

- `GET /`: Health check básico del servicio.
- `POST /predict`: Inferencia simulada de backward compatibility.
- `POST /v1/training-jobs`: Solicita un trabajo asíncrono de entrenamiento para `random_forest` o `xgboost`. Requiere header `Idempotency-Key`. Retorna `202 Accepted` con `job_id` y estado `QUEUED`.
- `GET /v1/training-jobs/{jobId}`: Consulta el estado, progreso, candidato generado o detalle de error según el estándar RFC 7807 Problem Details.

## Pipeline de Preparación y Modelado

- **Partición temporal y agrupamiento:** `temporal_student_grouped_split` asegura que periodos recientes queden en test y que ningún estudiante aparezca en ambos conjuntos (prevención de fuga por identidad).
- **Imputación y preprocesamiento:** Imputación por mediana ajustada **exclusivamente con datos de entrenamiento**.
- **Balanceo SMOTE:** `apply_smote_if_warranted` evalúa el ratio de desbalance y aplica `SMOTE` o `SMOTENC` **únicamente sobre el fold de entrenamiento**. Test y validación permanecen con su distribución observada real.
- **Selección de hiperparámetros:** `StratifiedGroupKFold` agrupa por estudiante dentro del train temporal. Cada fold ajusta su propio preprocesador y sampler; se selecciona por recall medio. El holdout temporal solo se evalúa después de fijar la configuración ganadora.
- **Trazabilidad de artefactos:** Cada intento genera en `/artifacts/{job_id}-attempt-{n}/`:
  - `model.joblib`: Modelo entrenado.
  - `pipeline.joblib`: Pipeline de preprocesamiento serializado.
  - `manifest.json`: Manifiesto conforme al contrato `ModelManifest` con digest SHA-256.
  - `metrics.json`: Métricas de evaluación (Accuracy, Recall, Precision, F1, ROC-AUC, PR-AUC, matriz de confusión).
  - `training_config.json`: Hiperparámetros efectivos y configuración usada.
  - `balance_report.json`: Decisión y registro de la técnica de balanceo.
  - `dependency_lock.json`: Versiones exactas de Python y librerías ML.
  - `feature_names.json`: Lista ordenada de variables predictoras.

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
docker compose run --rm --no-deps prediction-worker python /app/tests/integration/stack_smoke.py
```

La prueba crea trabajos sintéticos y comprueba la ruta API → PostgreSQL/outbox → RabbitMQ → worker, el reintento del outbox, la recuperación de una lease vencida y el digest del artefacto. No usa datos institucionales.
