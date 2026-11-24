# Guía: entrenar un modelo desde el portal admin

Esta guía explica cómo entrenar un modelo de deserción desde el portal admin. Los pasos son los que el sistema permite hoy. Lo que todavía no se puede hacer desde el portal está marcado.

Proceso completo:

1. **Extraer** el dataset del DW. Hoy es un comando.
2. **Comprimirlo** en un `.zip`.
3. **Subirlo** al portal.
4. **Entrenar** el candidato desde el portal.
5. **Activar** el candidato desde el portal (o promover/revertir por comando).

> **Desde PRED-101 no se requiere aprobación DSA.** El objetivo y la población de cada tarea están definidos en el catálogo de tareas (`prediction-service/ml_tasks/`, consultable en `GET /v1/ml-tasks`). Basta el permiso `prediction:train`; quién activa, cuándo y con qué motivo queda auditado en el registro de modelos. Los modelos entrenados con datos sintéticos siguen sin poder activarse.

## 0. Requisitos previos

| Requisito | Cómo verificarlo |
|---|---|
| Cuenta con rol `SUPERADMIN` | Solo esa cuenta ve **Operaciones ML** en el menú. El servicio de predicción exige el permiso `prediction:train`, que SUPERADMIN incluye. |
| DW cargado con los cortes a usar | En el portal admin, **Cierres académicos**: los cortes deben estar en `PROCESADO`. **Ejecuciones ETL**: la última ejecución de cada corte debe ser `EXITOSA`. |
| Entorno local | Git Bash, `uv`, Python y Docker con el contenedor `postgres-dw` corriendo. El DW debe estar accesible en `localhost:5434`. |

## 1. Extraer el dataset del DW (script)

El portal todavía no extrae datos del DW. La extracción y el `.zip` se hacen con un solo script, [`prediction-service/scripts/extraer_dataset_dw.sh`](../../prediction-service/scripts/extraer_dataset_dw.sh). Corre en **Git Bash**, no en PowerShell. Desde PowerShell también se puede llamar con `bash`, con los mismos argumentos.

Desde la raíz del repositorio:

```bash
bash prediction-service/scripts/extraer_dataset_dw.sh --cadencia SEMESTRAL --horizonte 4 --salida outputs/datasets/desercion-4a
```

El script:
1. **Arma la lista de carreras** de la cadencia elegida desde el DW.
2. **Lee las credenciales del DW** del contenedor `postgres-dw`, sin mostrarlas.
3. **Ejecuta el extractor** (`training.dw_extract`).
4. **Deja el `.zip` listo** junto a la carpeta. Por ejemplo, `outputs/datasets/desercion-4a.zip`, con `manifest.json` y `rows.jsonl` en la raíz.

Con el historial completo tarda unos 15–20 minutos.

| Opción | Qué hace |
|---|---|
| `--cadencia SEMESTRAL` / `ANUAL` | Qué carreras entran: régimen `S` o `A`. Cada cadencia es un modelo distinto, no se mezclan |
| `--horizonte 4` | Un estudiante cuenta como desertor si no vuelve a cursar en su carrera dentro de los 4 años siguientes al corte. Los cortes cuyo horizonte todavía no está en el DW se excluyen solos. Sin esta opción, el objetivo es "no está en el corte siguiente" |
| `--salida <carpeta>` | Carpeta **nueva**. El script no sobrescribe un dataset existente |
| `--ref-objetivo`, `--ref-poblacion` | Opcionales. Reemplazan las referencias por defecto del catálogo (`catalog:<TAREA>:target:v1` y `catalog:<TAREA>:population:v1`). Solo sirven como etiqueta de trazabilidad: no cambian los datos ni bloquean el dataset |

**Referencias de objetivo y población:** el manifest siempre lleva `target_definition_ref` y `population_definition_ref`. Por defecto apuntan a la definición de la tarea en el catálogo (`ml_tasks`). La definición real la ponen las opciones (`--horizonte`, `--cadencia`) y queda descrita en `target_definition`.

Los estudiantes salen con pseudónimos. El archivo no contiene identificadores reales.

## 2. Revisar el resultado

El script termina mostrando la carpeta, la cantidad de filas y la ruta del `.zip`. Antes de subirlo, revisa en `manifest.json`:
- Las referencias `target_definition_ref` y `population_definition_ref` son las esperadas (por defecto, `catalog:...`).
- `target_definition` describe el objetivo; por ejemplo, `horizon_years` coincide con el horizonte pedido.

El servicio limita el tamaño del archivo subido y el del contenido descomprimido. Si el portal responde **413**, el dataset es demasiado grande para la configuración actual del servicio.

## 3. Subir el dataset al portal

1. Entra al portal admin con la cuenta `SUPERADMIN`.
2. En el menú, abre **Servicio de aprendizaje automático → Operaciones ML**.
3. Pulsa **Agregar conjunto de datos de entrenamiento**.
4. Arrastra el `.zip` o usa **Examinar archivos**, y confirma la subida.

El servicio valida el dataset contra el contrato de datos antes de guardarlo. Si lo acepta, muestra una referencia `custom:<dataset_id>`, que es la que eliges al entrenar.

| Respuesta | Qué significa | Qué hacer |
|---|---|---|
| `TARGET_DEFINITION_INCOMPLETE` (422) | El manifest no declara `target_field` y `target_definition` con sus clases | Vuelve a extraer con el script; no edites el manifest a mano |
| `DATASET_CONTRACT_VIOLATION` (422), otros códigos | El contenido no cumple el contrato | Lee los códigos del mensaje. No edites `rows.jsonl` a mano: corrige el origen y vuelve a extraer |
| `DATASET_ALREADY_EXISTS` (409) | Ese `dataset_id` ya se subió | Los datasets no se pueden modificar. Una extracción nueva genera otro `dataset_id` |
| `INVALID_FILE_TYPE` (400) | No es un `.zip` | Repite el paso 2 |
| 403 | La cuenta no tiene el rol requerido | Usa una cuenta `SUPERADMIN` |

## 4. Entrenar el candidato

1. En **Operaciones ML**, pulsa **Nuevo entrenamiento**.
2. Elige:
   - **Conjunto de datos de entrenamiento:** el `custom:<dataset_id>` del paso 3.
   - **Algoritmo:** Random Forest o XGBoost. Para comparar, lanza un entrenamiento por cada algoritmo con el mismo dataset.
   - **Referencia de configuración (opcional):** una configuración con la política de alerta y los hiperparámetros a probar. Por ejemplo, para deserción semestral a 4 años:

     | Algoritmo | Referencia de configuración |
     |---|---|
     | Random Forest | `desercion-semestral-4a-rf-v1` |
     | XGBoost | `desercion-semestral-4a-xgb-v1` |

     Cada configuración es un archivo `.json` en `infra/prediction-configurations/`, con una `decision_policy` (por ejemplo, la política del 20 % de alertas) y los hiperparámetros a probar. Esos archivos no se suben a git, así que en otra máquina hay que crearlos de nuevo con el mismo contenido. **Si la dejas vacía**, el umbral se elige en validación por recall y luego F1 (`threshold_origin: validation_recall_then_f1`) con la grilla de hiperparámetros por defecto.
3. Revisa el resumen y confirma.

**Seguimiento:**
- La tabla muestra **Solicitud**, **Algoritmo**, **Conjunto de datos**, **Estado** y **Candidato**.
- Los estados posibles son `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED` y `CANCELLED`.
- El portal no tiene botón para cancelar. El servicio sí tiene `POST /v1/training-jobs/{job_id}/cancel`, que se puede usar con un token de una cuenta `SUPERADMIN`.
- La lista de trabajos se guarda **en el navegador** donde los lanzaste. En otro navegador o equipo no aparece.

**Qué hace el entrenamiento:**
- Separa los datos por estudiante y por tiempo: los cortes más recientes quedan para la prueba final.
- Imputa los valores faltantes y balancea solo los datos de entrenamiento con SMOTE.
- Ajusta los hiperparámetros con validación cruzada temporal.
- Guarda un **candidato** con sus métricas.

Un `SUCCEEDED` **no activa** el modelo: el candidato queda registrado, pero no sirve predicciones.

## 5. Activar el candidato

En **Servicio de aprendizaje automático → Validación de modelos**, elige el candidato y pulsa **Activar**. Debes escribir un motivo. El registro guarda quién lo activó, cuándo y por qué, y el modelo pasa a servir predicciones para su evento y cadencia. **Desactivar** deja el alcance sin modelo activo.

- Se puede activar cualquier candidato entrenado con datos reales (incluidos los antiguos datasets marcados como exploratorios). No se requiere aprobación DSA.
- Los candidatos entrenados con datos **sintéticos** no se pueden activar.

### Promover o revertir por comando

La promoción por CLI del registro de modelos sigue disponible para operadores, y exige:

- Hay un reporte de evaluación PRED-004 con decisión `APTO` y `deployment_allowed: true`.
- El reporte selecciona un único candidato, y coincide exactamente con su `model_id`, su `version` y su `artifact_digest`.
- El digest del dataset y la definición del objetivo coinciden con el modelo.
- El operador registra su identidad.

El procedimiento, el rollback y las causas para volver a evaluar están en [PRED-005-operations.md](PRED-005-operations.md).

## Lo que hoy no se puede hacer desde el portal

| Tarea | Estado actual |
|---|---|
| Extraer el dataset del DW | Solo por comando (paso 1) |
| Entrenar el modelo de **reprobación de materia** | Los entrenamientos del portal solo preparan datasets de deserción. El modelo por materia se entrena por comando, con la preparación por evento (`prepare_event_dataset`) |
| Comparar candidatos o hacer rollback | Solo por comando (paso 5); pasa al portal con PRED-105 y PRED-107 |
| Cancelar un entrenamiento | Solo por la API del servicio (paso 4) |
| Ver los trabajos lanzados desde otro navegador | No disponible: la lista se guarda en el navegador que los lanzó |

## Antes de entrenar con datos nuevos

- **Después de cargar nuevos cortes:**
  - Verifica en **Ejecuciones ETL** que todos terminaron `EXITOSA`.
  - Reinicia el servicio OLAP para que los portales los muestren. El reinicio no afecta al entrenamiento, que lee directamente del DW.
- **Un dataset es una foto fija.** Para incorporar cortes nuevos hay que extraer, subir y entrenar otra vez.
- **Si cambian las variables, el objetivo o la población**, cambia el digest del contrato de features: hay que extraer y entrenar de nuevo, y activar el nuevo candidato.
