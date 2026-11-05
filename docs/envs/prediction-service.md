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

El servicio ya incluye inferencia individual (`POST /v1/predictions`), trabajos asíncronos y scoring poblacional. La ruta heredada `POST /predict` permanece deshabilitada para scoring confiable: devuelve un error si no puede resolver un bundle aprobado y features del DW desde una fuente confiable. La inferencia requiere configuración de identidad, acceso de lectura al DW y un modelo autorizado. El entorno `production` define el modo de arranque, pero por sí solo no significa que existan las aprobaciones, credenciales o evidencias necesarias para habilitar uso institucional.

Este archivo cubre solo las variables básicas de arranque. Consulta [Prediction Service](../../prediction-service/README.md) para las integraciones y variables actuales de API/worker, y [PRED-006](../prediction/PRED-006-implementation.md) y [PRED-007](../prediction/PRED-007-implementation.md) para su alcance funcional. No copies valores secretos de ambientes a la documentación.
