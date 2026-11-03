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

## Señales y responsables de reevaluación

La evaluación PRED-004 debe repetirse antes de promover un candidato cuando cambie cualquiera de estas condiciones:

| Señal verificable | Acción requerida |
| --- | --- |
| Cambia el `content_digest`/snapshot del dataset, se corrigen datos históricos o cambia la definición del objetivo/población | Crear una evaluación con el nuevo digest; comprobar nuevamente etiquetas, cortes y partición temporal. Una modificación de la definición del objetivo requiere aprobación DSA antes del entrenamiento institucional. |
| Cambian la cobertura de estudiantes/cursados/notas, la proporción de filas elegibles, la tasa de faltantes o la representación por cohorte y modalidad anual/semestral frente a la evaluación aprobada | Registrar cobertura observada y baseline anterior; investigar el cambio y reevaluar antes de promover. No se inventa un umbral numérico: DSA debe aprobar los límites de cobertura y deriva que se usarán en la política PRED-004. Mientras no existan, un cambio material o no explicado queda como `EVIDENCIA_INSUFICIENTE`. |
| Cambia el contrato o esquema: columnas, nombre/semántica, tipo, nulabilidad, unidades, categorías, orden o versión | Bloquear la promoción del bundle anterior para el nuevo esquema. Actualizar contrato/features, entrenar y evaluar con el nuevo esquema y verificar que la API carga el par modelo/preprocesador compatible. |
| Métricas de seguimiento en datos con resultado observado salen de la política aprobada, cambia la prevalencia de la clase de riesgo o aparecen diferencias relevantes entre cohortes/modalidades | Abrir revisión de desempeño/impacto, analizar recall, precisión, F1, PR-AUC y matriz de confusión por grupo, y emitir una nueva evaluación PRED-004 antes de reemplazar el modelo. Los límites aceptables son decisión institucional DSA, no valores implícitos del servicio. |

El **responsable de datos/ETL** registra la señal y adjunta digest, periodo, cobertura y/o diff del esquema. El **responsable del modelo (ML)** documenta el análisis y ejecuta PRED-004. **DSA** confirma la definición académica, los umbrales de cobertura/desempeño y la decisión de aptitud. La persona operadora registra su identidad al promover o hacer rollback; no sustituye la aprobación DSA.

Cada revisión queda en un reporte versionado en `docs/prediction/evidence/` (o el repositorio institucional aprobado), vinculado al snapshot/digest, definición de objetivo, esquema, métricas, cohortes analizadas, señal que la originó, fecha, responsable ML, aprobador DSA y decisión. Si la señal se detectó pero la evaluación o aprobación no concluyó, registrar el estado pendiente y mantener bloqueada la promoción; no reutilizar un `APTO` de otro digest/esquema.

## Smoke test aislado de Compose

El script siguiente construye ambas imágenes y levanta una pila efímera de API, worker y RabbitMQ con volúmenes nombrados exclusivos. Crea un bundle y evidencia **solo de integración** en ese volumen, reinicia la API y comprueba que carga el mismo modelo/preprocesador activo desde el volumen compartido. No usa el volumen normal del proyecto, base OLTP/DW ni datos institucionales; al terminar elimina únicamente el proyecto efímero y sus volúmenes.

```powershell
cd prediction-service
.\tests\integration\run_lifecycle_compose_smoke.ps1
```

El test de integración no constituye evaluación CRISP-DM, aprobación institucional ni evidencia para promover un modelo real. Los casos de reload exitoso, incompatibilidad de dependencias, fallo de deserialización sin cambio del activo y cambio de versión con pareja modelo/preprocesador también se cubren en `tests/test_model_registry.py`.

## Límites de este issue

PRED-005 deja versionado, aprobación, carga y rollback. El contrato de inferencia institucional también exige resolver identidad, programa, autorización y corte, y leer features confiables del DW. La ruta heredada `/predict` no cumple ese contrato: sin modelo devuelve `503 NO_ACTIVE_MODEL`; con un bundle cargado devuelve `503 TRUSTED_FEATURE_SOURCE_UNAVAILABLE`. El endpoint contractual `/v1/predictions`, su autorización y el adaptador de features DW deben completarse en el alcance de inferencia correspondiente. No enviar perfiles/features libres del cliente para sustituir el origen confiable.

Los artefactos `joblib` se aceptan únicamente desde el workspace configurado, con digest válido y manifiesto aprobado; no existe una operación para subir archivos de modelo desde una petición. La cuenta que opera el contenedor debe ser la única con escritura sobre artefactos y estado de registro.
