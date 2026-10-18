# ML Connector

Server-side HTTP client for the Prediction Service. It follows the current draft at [prediction-api-v1.yaml](../../../../docs/prediction/contracts/prediction-api-v1.yaml) and exports the corresponding request/response DTOs.

## Operations

- `predict`: `POST /v1/predictions`
- `submitTrainingJob`: `POST /v1/training-jobs` with a required `Idempotency-Key`
- `getTrainingJob`: `GET /v1/training-jobs/{jobId}`

Each call requires the service base URL and the verified bearer token supplied by the BFF. This connector does not read environment variables, log request bodies/tokens, or accept arbitrary feature data. It validates request and response shapes, forwards an optional request ID, rejects invalid service URLs, and enforces a bounded timeout.

The connector must only be called by server-side code. The BFF authenticates the portal session and forwards the verified token; the Prediction Service remains responsible for validating token claims and enforcing academic scope and operation permissions. No ML-specific Keycloak role has been invented here.

## Contract status

The repository's OpenAPI is explicitly a draft, and `prediction-service/main.py` currently exposes only a simulated `/predict` route. The v1 connector contract is therefore a typed integration scaffold aligned with the approved-in-repository draft, not evidence that the upstream service implements these operations. Before production use, implement/version the Prediction Service against this contract and resolve the pending policy decisions in `docs/prediction/contracts/contract-notes.md`.
