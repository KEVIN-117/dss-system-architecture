# Prediction Service

Servicio HTTP basado en FastAPI. La configuración de ejecución se lee de variables de entorno y se valida al iniciar el proceso.

## Configuración

| Variable | Default local | Descripción |
| --- | --- | --- |
| `PREDICTION_ENV` | `development` | Entorno de ejecución: `development`, `test` o `production`. |
| `PREDICTION_HOST` | `0.0.0.0` | Interfaz donde escucha Uvicorn. En contenedor debe mantenerse en `0.0.0.0`. |
| `PREDICTION_PORT` | `8000` | Puerto HTTP, entre 1 y 65535. |
| `PREDICTION_LOG_LEVEL` | `info` | Nivel de logging de Uvicorn. |
| `PREDICTION_RELOAD` | `false` | Recarga automática para desarrollo; se rechaza junto con `production`. |

Compose entrega `production`, `0.0.0.0`, puerto `8000`, logging `info` y recarga desactivada por defecto. Los valores configurables se pueden establecer en el `.env` raíz, tomando `.env.example` como referencia. No se publican puertos del servicio al host; los consumidores dentro de `dss-net` lo alcanzan en `http://prediction-service:8000`.

## Estado funcional

`GET /` confirma que el proceso responde. `POST /predict` todavía devuelve una predicción simulada y no debe interpretarse como resultado de un modelo entrenado. Esta configuración prepara el arranque del servicio; no configura lectura del DW, entrenamiento, artefactos de modelos, autenticación ni políticas operativas de ML.
