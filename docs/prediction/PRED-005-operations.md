# PRED-005 — Operación de versiones de modelos

## Estados y almacenamiento

El worker publica cada intento como un directorio inmutable de candidato (`/artifacts/{job_id}-attempt-{n}`). El manifiesto identifica el algoritmo, versión, snapshot/dataset, definición y orden de clases, esquema de entrada, semántica de probabilidad, configuración, dependencias y evaluación. `artifact_digest` cubre los hashes SHA-256 de todos los payloads y los metadatos inmutables del manifiesto. `manifest.json` no se auto-hashea; al aprobar, su hash se registra junto al puntero activo.

El estado activo y el historial de cambios viven juntos en `.model-registry/active.json` y se reemplazan en una sola operación atómica, evitando que la versión activa y el historial queden desincronizados. El reporte aprobatorio se conserva bajo `.model-registry/approvals/` y su hash queda ligado al puntero y al manifiesto. API y worker montan el mismo volumen Docker `prediction_artifacts`; no se debe borrar ni sustituir ese volumen durante despliegues. En instalaciones con más de un host, el volumen debe ser compartido con semántica de renombre atómico. Un almacenamiento local independiente por réplica no es compatible.

## Evaluar y aprobar

El entrenamiento nunca promueve automáticamente. Primero debe existir un reporte de evaluación institucional con decisión PRED-004 `APTO`, `crisp_dm_next_step.deployment_allowed: true`, selección única del candidato y una entrada que coincida exactamente con `model_id`, `version` y `artifact_digest`. El digest del dataset y la definición de evento/clases también deben coincidir con el bundle. El reporte tampoco puede ser de tipo fixture sintético. La promoción requiere además identidad explícita del operador. Si falla cualquier requisito, no cambia `active.json`.

La evidencia sintética guardada en `docs/prediction/evidence/PRED-004-synthetic-comparison.json` declara `EVIDENCIA_INSUFICIENTE` y `deployment_allowed: false`; solo sirve para validar software, no para activar un modelo institucional.

Con el directorio de artefactos y reporte de aprobación visibles en el host operativo:

```powershell
$env:WORKER_ARTIFACTS_DIR = "C:\ruta\al\volumen\prediction_artifacts"
uv run --project prediction-service python -m training.model_registry show
uv run --project prediction-service python -m training.model_registry promote `
  --model-id "<model_id>" `
  --version "<version>" `
  --approved-by "<identidad-operador>" `
  --evaluation-report "C:\ruta\al\reporte-aprobado.json"
```

El operador ejecuta la promoción con acceso de escritura al workspace y al reporte aprobado. No existe una API de promoción accesible a clientes. La aplicación valida todos los archivos, dependencias y carga del modelo/preprocesador antes de sustituir el puntero. El cambio de puntero es atómico: una carga fallida deja sirviéndose la versión previa.

## Reversión y recuperación

```powershell
uv run --project prediction-service python -m training.model_registry rollback `
  --approved-by "<identidad-operador>"
```

El rollback verifica y carga el bundle previo completo y luego reemplaza atómicamente el puntero. Si no existe una versión previa aprobada o no supera validaciones de integridad/compatibilidad, el rollback falla sin cambiar el modelo activo.

Tras reiniciar API o worker, los candidatos, el puntero y el historial se recuperan del volumen persistente. El primer acceso a una versión activa vuelve a verificar su manifiesto, hashes, esquema, clases y compatibilidad exacta de Python, scikit-learn, XGBoost y joblib antes de deserializar. Si la comprobación falla, la API responde `503 ACTIVE_MODEL_UNAVAILABLE`; no usa un candidato alternativo ni fabrica una predicción. Se puede restaurar desde el último evento `PROMOTE` válido o efectuar rollback a una versión aprobada íntegra.

## Límites de este issue

PRED-005 deja versionado, aprobación, carga y rollback. El contrato de inferencia institucional también exige resolver identidad, programa, autorización y corte, y leer features confiables del DW. La ruta heredada `/predict` no cumple ese contrato: sin modelo devuelve `503 NO_ACTIVE_MODEL`; con un bundle cargado devuelve `503 TRUSTED_FEATURE_SOURCE_UNAVAILABLE`. El endpoint contractual `/v1/predictions`, su autorización y el adaptador de features DW deben completarse en el alcance de inferencia correspondiente. No enviar perfiles/features libres del cliente para sustituir el origen confiable.

Los artefactos `joblib` se aceptan únicamente desde el workspace configurado, con digest válido y manifiesto aprobado; no existe una operación para subir archivos de modelo desde una petición. La cuenta que opera el contenedor debe ser la única con escritura sobre artefactos y estado de registro.
