# Guía: entrenar un modelo desde el portal admin

Esta guía explica cómo entrenar un modelo de deserción desde el portal admin. Los pasos son los que el sistema permite hoy. Lo que todavía no se puede hacer desde el portal está marcado.

Proceso completo:

1. **Extraer** el dataset del DW. Hoy es un comando.
2. **Comprimirlo** en un `.zip`.
3. **Subirlo** al portal.
4. **Entrenar** el candidato desde el portal.
5. **Evaluar y promover**. Hoy es un comando, y requiere aprobación DSA.

## 0. Requisitos previos

| Requisito | Cómo verificarlo |
|---|---|
| Cuenta con rol `SUPERADMIN` | Solo esa cuenta ve **Operaciones ML** en el menú. El servicio de predicción solo acepta los roles de `PREDICTION_TRAINING_ROLES` (por defecto `["SUPERADMIN"]`). |
| DW cargado con los cortes a usar | En el portal admin, **Cierres académicos**: los cortes deben estar en `PROCESADO`. **Ejecuciones ETL**: la última ejecución de cada corte debe ser `EXITOSA`. |
| Definición del objetivo y de la población **aprobadas por DSA** | Necesitas las dos referencias de esas aprobaciones, registradas en [decisiones-dsa](decisiones-dsa/README.md). Sin ellas el portal rechaza el dataset (ver paso 3). No se inventan referencias. |
| Entorno local | Git Bash, `uv`, Python y Docker con el contenedor `postgres-dw` corriendo. El DW debe estar accesible en `localhost:5434`. |

## 1. Extraer el dataset del DW (script)

El portal todavía no extrae datos del DW. La extracción y el `.zip` se hacen con un solo script, [`prediction-service/scripts/extraer_dataset_dw.sh`](../../prediction-service/scripts/extraer_dataset_dw.sh). Corre en **Git Bash**, no en PowerShell. Desde PowerShell también se puede llamar con `bash`, con los mismos argumentos.

Desde la raíz del repositorio:

```bash
bash prediction-service/scripts/extraer_dataset_dw.sh --cadencia SEMESTRAL --horizonte 4 --salida outputs/datasets/desercion-4a --ref-objetivo "dsa:objetivo:2026-001:v1" --ref-poblacion "dsa:poblacion:2026-002:v1"
```

Con otras decisiones aprobadas, cambia las dos referencias (`<REF_OBJETIVO_DSA>`, `<REF_POBLACION_DSA>`) por las que correspondan.

El script:
1. **Verifica las referencias.** Cada una tiene que estar en el [registro de decisiones DSA](decisiones-dsa/README.md) con estado `APROBADA`. Si no está, se detiene sin extraer nada.
2. **Arma la lista de carreras** de la cadencia elegida desde el DW.
3. **Lee las credenciales del DW** del contenedor `postgres-dw`, sin mostrarlas.
4. **Ejecuta el extractor** (`training.dw_extract`).
5. **Deja el `.zip` listo** junto a la carpeta. Por ejemplo, `outputs/datasets/desercion-4a.zip`, con `manifest.json` y `rows.jsonl` en la raíz.

Con el historial completo tarda unos 15–20 minutos.

| Opción | Qué hace |
|---|---|
| `--cadencia SEMESTRAL` / `ANUAL` | Qué carreras entran: régimen `S` o `A`. Cada cadencia es un modelo distinto, no se mezclan |
| `--horizonte 4` | Un estudiante cuenta como desertor si no vuelve a cursar en su carrera dentro de los 4 años siguientes al corte. Los cortes cuyo horizonte todavía no está en el DW se excluyen solos. Sin esta opción, el objetivo es "no está en el corte siguiente" |
| `--salida <carpeta>` | Carpeta **nueva**. El script no sobrescribe un dataset existente |
| `--ref-objetivo`, `--ref-poblacion` | Las referencias de las decisiones DSA, siempre las dos juntas. Sin ellas, el dataset sale **no aprobado**: sirve para explorar, pero el portal lo rechaza |

**De dónde salen `<REF_OBJETIVO_DSA>` y `<REF_POBLACION_DSA>`:**
- Son los identificadores de dos decisiones formales de DSA (PRED-002, punto "Decisiones que requieren aprobación DSA"):
  - **Objetivo:** qué es "riesgo" (por ejemplo, deserción a 4 años), sus clases y su horizonte.
  - **Población:** qué estudiantes y cortes entran y cuáles se excluyen.
- Tienen la forma `dsa:<tipo>:<AAAA>-<NNN>:v<versión>`, y solo valen las que tienen estado `APROBADA` en el [registro de decisiones DSA](decisiones-dsa/README.md). Ahí están el formato, la plantilla para registrar una decisión y las propuestas que esperan aprobación.
- **No cambian los datos extraídos.** La definición real la ponen las opciones (`--horizonte`, `--cadencia`). Las referencias dejan constancia de qué decisión DSA autoriza esa definición, y se copian al dataset, al modelo y a la evaluación.
- **Decisiones aprobadas hoy** para deserción semestral a 4 años: `dsa:objetivo:2026-001:v1` y `dsa:poblacion:2026-002:v1`. La política del 20 % (`dsa:politica:2026-003:v1`) se aplica en el entrenamiento, no en la extracción (ver el paso 4). Cualquier referencia que no esté en el registro con estado `APROBADA` se rechaza.
- El extractor de Python, usado directamente, acepta cualquier texto no vacío en `--target-definition-ref` y `--population-definition-ref`. Por eso conviene usar siempre el script, que valida las referencias contra el registro.

Los estudiantes salen con pseudónimos. El archivo no contiene identificadores reales.

## 2. Revisar el resultado

El script termina mostrando la carpeta, la cantidad de filas y la ruta del `.zip`. Antes de subirlo, revisa en `manifest.json`:
- `target_approved` y `eligibility_approved` están en `true`, y las referencias son las que esperabas.
- `target_definition` describe el objetivo aprobado; por ejemplo, `horizon_years` coincide con la decisión.

El servicio limita el tamaño del archivo subido y el del contenido descomprimido. Si el portal responde **413**, el dataset es demasiado grande para la configuración actual del servicio.

## 3. Subir el dataset al portal

1. Entra al portal admin con la cuenta `SUPERADMIN`.
2. En el menú, abre **Servicio de aprendizaje automático → Operaciones ML**.
3. Pulsa **Agregar conjunto de datos de entrenamiento**.
4. Arrastra el `.zip` o usa **Examinar archivos**, y confirma la subida.

El servicio valida el dataset contra el contrato de datos antes de guardarlo. Si lo acepta, muestra una referencia `custom:<dataset_id>`, que es la que eliges al entrenar.

| Respuesta | Qué significa | Qué hacer |
|---|---|---|
| `TARGET_NOT_APPROVED` / `POPULATION_NOT_APPROVED` (422) | Faltan la aprobación DSA o sus referencias | Repite el paso 1 con `--ref-objetivo` y `--ref-poblacion` de decisiones aprobadas |
| `DATASET_CONTRACT_VIOLATION` (422), otros códigos | El contenido no cumple el contrato | Lee los códigos del mensaje. No edites `rows.jsonl` a mano: corrige el origen y vuelve a extraer |
| `DATASET_ALREADY_EXISTS` (409) | Ese `dataset_id` ya se subió | Los datasets no se pueden modificar. Una extracción nueva genera otro `dataset_id` |
| `INVALID_FILE_TYPE` (400) | No es un `.zip` | Repite el paso 2 |
| 403 | La cuenta no tiene el rol requerido | Usa una cuenta `SUPERADMIN` |

## 4. Entrenar el candidato

1. En **Operaciones ML**, pulsa **Nuevo entrenamiento**.
2. Elige:
   - **Conjunto de datos de entrenamiento:** el `custom:<dataset_id>` del paso 3.
   - **Algoritmo:** Random Forest o XGBoost. Para comparar, lanza un entrenamiento por cada algoritmo con el mismo dataset.
   - **Referencia de configuración:** la configuración que aplica la política de alerta aprobada. Para deserción semestral a 4 años:

     | Algoritmo | Referencia de configuración |
     |---|---|
     | Random Forest | `desercion-semestral-4a-rf-v1` |
     | XGBoost | `desercion-semestral-4a-xgb-v1` |

     Cada configuración es un archivo `.json` en `infra/prediction-configurations/`. Contiene la política del 20 % (`dsa:politica:2026-003:v1`) y los hiperparámetros a probar. Esos archivos no se suben a git, así que en otra máquina hay que crearlos de nuevo con el mismo contenido. **La referencia es obligatoria con datos reales.** Si la dejas vacía, el trabajo termina en `FAILED` con "Institutional evaluation requires an approved DSA decision_policy": el sistema no evalúa un modelo institucional sin una política aprobada.
3. Revisa el resumen. Marca la confirmación de que el dataset está autorizado y tiene aprobación DSA vigente, y confirma.

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

## 5. Evaluar y promover (comando, con aprobación DSA)

**No existe una opción de promoción en el portal, y es intencional.** La promoción la hace un operador con el CLI del registro de modelos, y solo si se cumple todo esto:

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
| Entrenamientos **exploratorios**, sin aprobación DSA | Solo por comando. El portal los rechaza a propósito. Sus resultados quedan marcados `exploratory_unapproved` y nunca se pueden promover |
| Promover o hacer rollback | Solo por comando, con evaluación PRED-004 aprobada (paso 5) |
| Cancelar un entrenamiento | Solo por la API del servicio (paso 4) |
| Ver los trabajos lanzados desde otro navegador | No disponible: la lista se guarda en el navegador que los lanzó |

## Antes de entrenar con datos nuevos

- **Después de cargar nuevos cortes:**
  - Verifica en **Ejecuciones ETL** que todos terminaron `EXITOSA`.
  - Reinicia el servicio OLAP para que los portales los muestren. El reinicio no afecta al entrenamiento, que lee directamente del DW.
- **Un dataset es una foto fija.** Para incorporar cortes nuevos hay que extraer, subir y entrenar otra vez.
- **Si cambian las variables, el objetivo o la población**, PRED-005 exige repetir la evaluación PRED-004 antes de promover.
