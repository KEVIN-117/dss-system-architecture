# Prediction Service & Training Worker

Servicio HTTP basado en FastAPI y worker de entrenamiento aislado basado en Celery con RabbitMQ, diseñado conforme al ADR-PRED-001 (CRISP-DM, RNF-09).

## Arquitectura de dos contenedores

El servicio está desacoplado en dos imágenes Docker independientes para garantizar el aislamiento de recursos y evitar la degradación de inferencias durante el entrenamiento intensivo:

1. **`prediction-service` (API):** Contenedor ligero FastAPI para health checks, inferencias y control de trabajos asíncronos (`Dockerfile`).
2. **`prediction-worker` (Worker ML):** Contenedor Celery aislado con librerías de ML (`scikit-learn`, `xgboost`, `imbalanced-learn`, `pandas`, `numpy`, `joblib`) para preparación, balanceo y entrenamiento de modelos (`Dockerfile.worker`).

Ambos comparten un volumen (`prediction_artifacts`) para el almacén de estado (`job_store.json`) y la persistencia de artefactos candidatos.

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
           +------------> [ prediction_artifacts ] <+
                          - job_store.json
                          - /artifacts/{job_id}/
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

### Variables del Worker y Broker

| Variable | Default local | Descripción |
| --- | --- | --- |
| `RABBITMQ_HOST` | `rabbitmq` | Host del broker RabbitMQ. |
| `RABBITMQ_PORT` | `5672` | Puerto AMQP de RabbitMQ. |
| `RABBITMQ_USERNAME` | `guest` | Usuario de autenticación RabbitMQ. |
| `RABBITMQ_PASSWORD` | `guest` | Contraseña de RabbitMQ. |
| `RABBITMQ_VHOST` | `/` | Virtual host en RabbitMQ. |
| `CELERY_BROKER_URL` | *(calculada)* | URL AMQP completa (`amqp://user:pass@host:port/vhost`). |
| `WORKER_MAX_CONCURRENT_JOBS` | `1` | Límite explícito de concurrencia de entrenamiento. |
| `WORKER_JOB_TIMEOUT_SECONDS` | `1800` | Tiempo límite por trabajo (30 minutos por defecto). |
| `WORKER_ARTIFACTS_DIR` | `/app/artifacts` | Ruta del volumen para persistencia de artefactos. |
| `WORKER_JOB_STORE_PATH` | `/app/artifacts/job_store.json` | Ruta del archivo de estado de trabajos. |
| `WORKER_RANDOM_SEED` | `42` | Semilla por defecto para reproducibilidad. |

## Endpoints de la API

- `GET /`: Health check básico del servicio.
- `POST /predict`: Inferencia simulada de backward compatibility.
- `POST /v1/training-jobs`: Solicita un trabajo asíncrono de entrenamiento para `random_forest` o `xgboost`. Requiere header `Idempotency-Key`. Retorna `202 Accepted` con `job_id` y estado `QUEUED`.
- `GET /v1/training-jobs/{jobId}`: Consulta el estado, progreso, candidato generado o detalle de error según el estándar RFC 7807 Problem Details.

## Pipeline de Preparación y Modelado

- **Partición temporal y agrupamiento:** `temporal_student_grouped_split` asegura que periodos recientes queden en test y que ningún estudiante aparezca en ambos conjuntos (prevención de fuga por identidad).
- **Imputación y preprocesamiento:** Imputación por mediana ajustada **exclusivamente con datos de entrenamiento**.
- **Balanceo SMOTE:** `apply_smote_if_warranted` evalúa el ratio de desbalance y aplica `SMOTE` o `SMOTENC` **únicamente sobre el fold de entrenamiento**. Test y validación permanecen con su distribución observada real.
- **Trazabilidad de artefactos:** Cada ejecución completada genera en `/artifacts/{job_id}/`:
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
