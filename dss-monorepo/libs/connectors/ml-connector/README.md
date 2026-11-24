# ML Connector

Server-side HTTP client for `prediction-service`. The BFF calls it with the service base URL and the verified bearer token of the session; prediction-service validates the token again and enforces its own permissions (`prediction:train`, `prediction:forecast:read`, `analytics:*` with academic scope).

## Operations

### Predictions and training (`ml-service-client.ts`)
| Function | Endpoint |
|---|---|
| `predict` | `POST /v1/predictions`: every serving event of the catalog (`program_dropout`, `student_backlog`, `student_gpa`; with `course_ref`: `course_abandonment`, `course_failure`, `course_final_grade`). Regression responses carry `predicted_value`, `prediction_interval` and `unit` instead of a class |
| `submitTrainingJob` | `POST /v1/training-jobs` (`random_forest`, `xgboost` or `ridge`, optional `search_space`), with a required `Idempotency-Key` |
| `getTrainingJob` | `GET /v1/training-jobs/{jobId}` |

### ML Studio (`ml-admin-client.ts`, PRED-106)
| Function | Endpoint |
|---|---|
| `listMlTasks` | `GET /v1/ml-tasks` |
| `listMlJobs`, `getMlJob`, `cancelMlJob` | `GET /v1/jobs`, `GET /v1/jobs/{id}`, `POST /v1/jobs/{id}/cancel` |
| `submitDatasetExtraction` | `POST /v1/dataset-extractions` |
| `listMlDatasets`, `getDatasetProfile`, `getDatasetSample` | `GET /v1/datasets`, `…/{ref}/profile`, `…/{ref}/sample` |
| `submitTrainingStudy` | `POST /v1/training-studies` |
| `compareModels`, `rollbackModel`, `getModelHistory` | `GET /v1/models/compare`, `POST /v1/models/rollback`, `GET /v1/models/{id}/history` |
| `submitForecastJob`, `getForecasts` | `POST /v1/forecast-jobs`, `GET /v1/forecasts` |

## Behaviour
- **Input validation before calling the service.** Ids, references, cadences, limits, search spaces and Idempotency-Keys are checked first. Invalid input throws `MlRequestValidationError` (a `TypeError`), which the BFF maps to 400. A network failure (fetch's own `TypeError`) is not that class and becomes 502.
- **Forward-compatible responses.** Responses are checked for the fields the BFF relies on; fields added by newer service versions are tolerated. Before PRED-106 an exact field list made `predict` and `getTrainingJob` reject every response once prediction-service added `task_kind`, `job_kind` and related fields.
- **Problems.** Service errors become `MlServiceClientError` with the RFC 7807 problem (any upper-case `code`, optional `detail`); timeouts become `MlServiceTimeoutError`.
- **No configuration.** The connector reads no environment variables, never logs bodies or tokens, rejects service URLs with credentials or query strings, uses `redirect: 'manual'`, and bounds every request with a timeout (15 s by default).
