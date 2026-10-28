# PRED-004 — Protocolo de evaluación y comparación independiente

**Estado:** protocolo técnico y utilidades implementados; la evaluación institucional permanece pendiente de extracción autorizada y decisiones DSA.
**Rama:** `feature/PRED-004`.
**Issue:** [PRED-004](https://github.com/KEVIN-117/dss-system-architecture/issues/147).
**Fase CRISP-DM:** Evaluación, con retorno a comprensión/preparación/modelado si la evidencia lo exige.
**Dependencias:** PRED-002 y PRED-003.

## 1. Objetivo y límite

Comparar Random Forest y XGBoost sobre el mismo dataset, definición de objetivo y partición temporal independiente. Cualquier selección técnica debe basarse solo en validación. El test se reserva para el reporte final y no puede elegir modelo, hiperparámetros ni umbral.

Los fixtures PRED-003 solo prueban código y reproducibilidad. No permiten afirmar utilidad, aptitud ni rechazo institucional. Hasta recibir dataset autorizado, definición de evento/población/horizonte y política de costes aprobada, la decisión es `EVIDENCIA_INSUFICIENTE`.

## 2. Hallazgo que requiere corregir PRED-003

El particionador vigente ordena estudiantes por la fecha de su último registro y asigna grupos completos a train/test. Esa estrategia evita que un estudiante aparezca en ambos grupos, pero no fija una frontera temporal global: un registro de test puede ser anterior a registros de entrenamiento. Por ello no acredita una evaluación de periodos futuros.

### Protocolo temporal v1

1. Ordenar los periodos académicos únicos por `(academic_year, academic_period)`.
2. Reservar para test el bloque final de periodos según `test_ratio`, con al menos un periodo y dejando periodos anteriores para entrenamiento.
3. Test contiene observaciones solo del bloque final. Train contiene observaciones anteriores a la frontera, excepto el historial anterior de cualquier estudiante presente en test; ese historial se excluye para evitar solapamiento por estudiante.
4. Verificar mecánicamente que `max(train_period) < min(test_period)` y que la intersección de estudiantes train/test es vacía. Registrar periodos, filas, estudiantes y filas/estudiantes excluidos, sin persistir identificadores directos.
5. Las métricas se calculan por observación de corte estudiante-programa-periodo. Se reportan también filas por estudiante y estudiantes únicos. Esta unidad de ponderación es provisional hasta que DSA confirme si la utilidad debe medirse por corte o por estudiante.

El procedimiento falla explícitamente si no existen suficientes periodos para formar train y test, si alguna partición queda vacía, o si la clase/objetivo no permite entrenar. No vuelve a una partición aleatoria como fallback.

## 3. Protocolo de comparación pre-registrado

- Ambos modelos reciben el mismo snapshot, objetivo, corte temporal, grupos y política de decisión. Un identificador/digest de partición común permite verificarlo.
- Validación agrupada por estudiante dentro de train compara candidatos y ajusta hiperparámetros. El criterio técnico heredado de PRED-003 es recall medio y F1 medio como desempate; se identifica como propuesta, no como criterio institucional aprobado.
- El umbral no se optimiza con test y su origen queda registrado. En fixtures se deriva de validación por recall y F1 como regla descriptiva; para datos institucionales se exige política DSA aprobada con costes antes de abrir el test. No se inventa un mínimo obligatorio de Recall/F1 ni un coste de error.
- Para evidencia institucional, el worker rechaza abrir el test si no recibe `decision_policy` con `approved: true`, `policy_ref`, `false_negative_cost` y `false_positive_cost` finitos y no negativos (al menos un coste positivo). Con política aprobada, deriva el umbral de las probabilidades out-of-fold de validación y selecciona candidatos por coste de validación, recall y F1. Los fixtures sintéticos ejercitan el flujo sin política; su decisión sigue siendo `EVIDENCIA_INSUFICIENTE`.
- El reporte muestra los dos modelos; no transforma diferencias en una decisión institucional si falta criterio aprobado. Una política versionada puede seleccionar umbral/modelo desde validación cuando DSA la proporcione.
- Una vez abierto el reporte final de test, cualquier cambio de features, hiperparámetros, threshold o selección requiere nueva validación y un nuevo protocolo/snapshot de prueba. Reutilizar ese test para iterar lo degrada a validación.

## 4. Contenido del reporte

Por modelo: clase positiva/negativa y definición de objetivo; matriz de confusión con orden de clases; precision, recall, F1 y soporte por clase; esquema de promedios; exactitud como complemento; ROC-AUC/PR-AUC si aplican; y razón explícita cuando una métrica no esté definida. Incluir filas y estudiantes únicos, distribución de observaciones por estudiante, y particiones.

El linaje vincula el reporte con dataset ID/digest, referencias de objetivo y población, split/version/fingerprint, algoritmo/model ID/versión/digest, hiperparámetros, threshold/política, semilla, dependencias, fechas y tipo de evidencia. No se persisten identificadores estudiantiles en el reporte.

## 5. Decisión y retorno CRISP-DM

La decisión admite `APTO`, `NO_APTO` o `EVIDENCIA_INSUFICIENTE`. No se configura un mínimo numérico genérico. Sin aprobación DSA, la etiqueta de decisión no pasa de `EVIDENCIA_INSUFICIENTE` aunque el reporte sintético o técnico sea reproducible.

| Condición | Fase a retomar / bloqueo |
|---|---|
| Evento, clase, horizonte, elegibilidad o coste sin aprobar | Business Understanding; no certificar aptitud |
| Extracción no autorizada, digest/cobertura/calidad faltantes | Data Understanding / PRED-002 |
| Split inválido, overlap o variable posterior al corte | Data Preparation / PRED-002–003 |
| Métricas no calculables o comparación inconclusa | Evaluación; registrar limitación y obtener nueva evidencia |
| Rendimiento/utilidad no satisface política DSA | Business Understanding o Modelado, con motivo; no desplegar |

## 6. Verificación asociada a criterios

- Split de periodos globalmente ordenado, estudiantes sin cruce y exclusiones cuantificadas.
- Reporte de ambos algoritmos con misma partición/target; rechazar combinación con fingerprints incompatibles.
- Métricas comprobadas contra matriz conocida y casos de clase ausente/predicciones sin positivos, mostrando valores indefinidos con su razón.
- Selección derivada de validación; modificar métricas de test no debe cambiar el candidato seleccionado.
- Metadatos suficientes para reproducir y tipo de evidencia que impida presentar fixture sintético como evidencia institucional.
- La suite de software no equivale a la evaluación predictiva institucional.

## 7. Insumos DSA/DW que siguen pendientes

1. Snapshot DW autorizado con manifiesto, digest, población aprobada y target/horizonte aprobados.
2. Regla institucional de coste relativo de falsos negativos y falsos positivos, y rol autorizado para aprobar el protocolo. La API recibe una referencia; el catálogo `PREDICTION_CONFIG_ROOT` debe provisionarse solo con configuraciones aprobadas por el entorno operativo.
3. Decisión sobre la unidad de evaluación ante múltiples observaciones del mismo estudiante: por corte estudiante-programa o por estudiante/episodio.
4. Criterios cuantitativos de utilidad/capacidad para emitir `APTO` o `NO_APTO`; no se fijan por esta implementación.

El código y los tests sintéticos pueden completarse sin esos insumos. El reporte final institucional y el cierre científico de PRED-004 no.

## 8. Componentes implementados

- `preparation/partitioner.py`: holdout temporal global; excluye del train el historial de estudiantes que aparecen en test y verifica una frontera temporal estricta.
- `preparation/pipeline.py`: fingerprint reproducible de dataset, objetivo, features y protocolo de partición; metadata sin IDs estudiantiles.
- `evaluation/metrics.py`: métricas por clase, soporte, matriz nombrada y razones explícitas para valores indefinidos.
- `evaluation/comparison.py`: compara artefactos RF/XGBoost solo si comparten snapshot, objetivo, política y partición; produce JSON y elige por validación. El test se incorpora únicamente al reporte final.
- Reporte ejecutado con ambos modelos sintéticos: [`PRED-004-synthetic-comparison.json`](evidence/PRED-004-synthetic-comparison.json). Su decisión queda explícitamente en `EVIDENCIA_INSUFICIENTE` y dirige la iteración a Business/Data Understanding.
- `training/trainer.py`: el test institucional queda cerrado sin política DSA aprobada; en fixtures se registra el alcance no institucional.
- `training/configuration.py`: resuelve `configuration_ref` a un JSON del catálogo operativo de solo lectura, limita referencias a identificadores simples y registra su SHA-256. No se aceptan costes directamente en el request.
- Tests cubren frontera temporal, historial excluido, solapamiento, matriz conocida, clase ausente, política/umbral y selección independiente de métricas test.

Ejemplo de comparación de dos jobs completados:

```powershell
uv run python -m evaluation.comparison --output artifacts/pred004-comparison.json `
  artifacts/<job-rf>/ artifacts/<job-xgb>/
```
