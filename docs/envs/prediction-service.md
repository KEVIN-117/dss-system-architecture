# Prediction Service

El servicio se configura mediante variables de entorno, sin secretos en este contrato.

| Variable | Default en Compose | Formato / valores | Secreto |
| --- | --- | --- | --- |
| `PREDICTION_ENV` | `production` | `development`, `test`, `production` | No |
| `PREDICTION_HOST` | `0.0.0.0` | Host no vacío; en Compose debe escuchar en todas las interfaces del contenedor | No |
| `PREDICTION_PORT` | `8000` | Entero de 1 a 65535 | No |
| `PREDICTION_LOG_LEVEL` | `info` | `critical`, `error`, `warning`, `info`, `debug`, `trace` | No |
| `PREDICTION_RELOAD` | `false` | Booleano: `true`/`false` (`1`/`0`, `yes`/`no`, `on`/`off` también aceptados) | No |

Para ejecución local, `.env.example` usa `PREDICTION_ENV=development`; para Compose, el fallback es `production`. `PREDICTION_RELOAD=true` no es válido en `production`. Compose no publica el puerto del servicio al host: permanece accesible desde la red `dss-net` en `http://prediction-service:8000`.

El entorno `production` solo define el modo de arranque y no significa que el servicio ya ofrezca inferencia real. `POST /predict` sigue siendo simulado; la integración con DW, modelos, worker, secretos y autenticación queda fuera de este contrato actual.
