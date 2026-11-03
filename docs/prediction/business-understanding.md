# PRED-001 — Acta de comprensión del negocio y plan CRISP-DM

**Estado:** alcance técnico de PRED-006 acordado para experimentación Faker; aprobación institucional de targets, utilidad y despliegue sigue pendiente.
**Trazabilidad:** issue PRED-001, RF-10, RF-11, RF-12, RNF-08 y RNF-09.

## 1. Problema institucional

El DSS busca producir evidencia anticipada sobre riesgo de deserción académica para que las autoridades puedan focalizar revisión e intervenciones oportunas. La decisión del motor es una **estimación de apoyo**. No determina por sí sola el abandono real, no asigna tutorías y no ejecuta decisiones pedagógicas o administrativas.

El Perfil del Proyecto propone clasificación de riesgo. Para la implementación de PRED-006 se separan dos problemas supervisados: abandono de materia y abandono de programa. Se conservan en datasets y bundles distintos porque cambian la unidad de evaluación, el evento y la temporalidad. Los resultados Faker solo validan la integración técnica; DSA aún debe aprobar el uso institucional y los criterios de utilidad.

### Definición de trabajo para PRED-006

- **Abandono de materia:** etiqueta `dw.fact_cursado.es_abandono`; grano estudiante–materia–período; features limitadas a metadatos de la materia y cursados anteriores.
- **Abandono de programa:** `DESERTOR` frente a `RETENIDO` en `dw.fact_retencion_desercion`; grano estudiante–programa–corte; el resultado observado usa el siguiente cierre esperado por cadencia.
- **Población:** primeros tres años académicos desde el primer cursado procesado del estudiante–programa: hasta tres cortes anuales o seis semestrales. Se excluyen cadencias mixtas.
- **Instante de observación:** cierre académico procesado. La feature debe acreditarse disponible al corte; la etiqueta no puede entrar en el esquema de entrada.
- **Exclusión de programa:** `NO_EVALUABLE`, egreso no validado, corte abierto/reabierto/ambiguo y perfiles fuera de población. No convertirlos en clase negativa.
- **Partición:** temporal, agrupada por estudiante; el mismo estudiante no puede cruzar train/test.
- **Estado de evidencia:** los datos Faker y las comparaciones RF/XGBoost sirven para pruebas de software. No certifican métricas institucionales ni habilitan promoción.
- **Variables candidatas:** campos académicos presentes y disponibles antes del horizonte. No se presuponen socioeconómicos, becas o bloqueos, porque no hay contrato actual del DW revisado que los exponga.

**Pendiente de aprobación institucional:** coste relativo de errores, umbrales de utilidad/capacidad, cobertura aceptable, instante oportuno para inferencia de materia y autorización para usar datos reales/desplegar. La cadencia se deriva de los cierres procesados (`1/2` semestral, `3` anual) y el código resuelve un bundle por evento/cadencia.

## 2. Usuarios y decisiones que apoyará

| Actor | Necesidad | Límite |
|---|---|---|
| Rector | Consultar vista global agregada de riesgo. | Acceso limitado por la política IAM vigente. |
| Decano | Revisar cohortes de su facultad. | Ámbito resuelto en servidor; no depende del filtro UI. |
| Director | Revisar estudiantes/cortes de su carrera. | Ámbito resuelto en servidor; no puede consultar otra carrera cambiando IDs. |
| Operador ML | Solicitar entrenamiento/evaluación y revisar estado técnico. | Es actor propuesto; DSA/IAM debe aprobar persona, responsabilidades y permiso. |
| Analista/DSA | Acordar evento, horizonte, exclusiones y utilidad de alertas. | No se encontró rol institucional de analista definido en el RBAC actual. |

Los roles y permisos globales (`RECTOR`, `DECANO`, `DIRECTOR`, `SUPERADMIN`; `analytics:global`, `analytics:faculty`, `analytics:career`) existen en el monorepo. El perfil del servicio de identidad expone `academicContexts` con `facultyId` y `careerId`. Sin embargo, la regla predictiva para contextos múltiples y el permiso de entrenamiento no está definida. `SUPERADMIN` es técnico y no debe recibir acceso académico automático.

## 3. Criterios de éxito

### Valor de negocio

DSA deberá acordar cómo equilibrar:

- Recall de la clase positiva, para reducir casos de riesgo no detectados (falsos negativos).
- Precision y F1, para que el volumen de alertas falsas sea manejable por la institución.
- Soporte por periodo/programa y tasa de perfiles excluidos, para entender cobertura y aplicabilidad.
- Capacidad y oportunidad de intervención de autoridades/tutores, para que las alertas generadas se puedan revisar.

**No se fija aquí un umbral mínimo de Recall/F1 ni un máximo de alertas.** DSA debe acordar el criterio cuantitativo y su fundamento antes de observar los resultados del conjunto de prueba. El Accuracy global no basta como criterio bajo posible desbalance.

### Validez de evaluación

- Entrenamiento y evaluación distinguen estudiantes repetidos por periodo; la división respeta tiempo y objetivo de generalización.
- Hold-out final no participa en imputación, codificación, balanceo, selección de variables, tuning ni selección de umbral.
- Random Forest y XGBoost se comparan con el mismo dataset/splits y semántica de etiqueta.
- Reporte: matriz de confusión, Recall, Precision, F1 y soporte por clase; esquema de promedio explícito, ROC-AUC/PR-AUC cuando sean calculables, prevalencia y decisión justificada.
- Reporte conserva dataset/snapshot, definición objetivo, splits, configuración, semilla, dependencias, versión y fecha.
- Una decisión de modelo puede ser `APTO`, `NO_APTO` o `EVIDENCIA_INSUFICIENTE`; no forzar despliegue si etiquetas/cobertura no permiten conclusión.

### Validez técnica y privacidad

- Solo inferir con un artefacto aprobado y un pipeline completo compatible; sin predicción simulada o fallback inventado.
- Respuesta indica clase, evento, versión y corte; probabilidad solo si existe y se asocia a la clase correcta.
- Entrenamiento falla/espera de forma independiente al API y OLAP; PRED-008 definirá carga, límites y tolerancia después de medir el ambiente.
- El servidor aplica identidad activa, permiso y ámbito institucional a consultas individuales, batch y estado de trabajos.
- Identificadores/features estudiantiles no se escriben en logs de aplicación; telemetría usa referencias técnicas y acceso acotado.

## 4. Alcance de PRED-001

PRED-001 define el vocabulario, criterios, responsabilidad y contratos iniciales para que PRED-002–008 implementen el flujo. No supone existir datos institucionales aprobados, ni activa modelo, ni fija DDL final para publicar predicciones.

| Capacidad | Situación para PRED-001 |
|---|---|
| RF/XGBoost, lectura DW, ciclo CRISP-DM | En alcance conceptual y trazado a issues posteriores. |
| API REST e inferencia | Se define contrato base y límite; implementación en PRED-006. |
| Inferencia individual / consulta por población | Se propone soportar ambas con semántica síncrona individual y scoring/publishing poblacional asíncrono; confirmar con consumidores. |
| Resultado analítico publicado | Se define resultado versionado separado del hecho observado; materialización/lectura OLAP en PRED-007. |
| What-If | Diferencia registrada frente al consolidado; no se incluye automáticamente en PRED-001/base. |
| SHAP por predicción | Requisito del consolidado que no tiene contrato/evidencia en las issues base actuales; requiere decisión/issue para incluirlo. |
| SSE | El estado de trabajos se especifica; SSE como transporte sigue pendiente. No es requisito automático del contrato base. |
| Banda visual alta/media/baja | No es clase de entrenamiento. Umbrales y calibración requieren decisión institucional y evidencia; no fijados aquí. |

## 5. Riesgos y mitigaciones CRISP-DM

| Riesgo | Efecto | Mitigación/retorno |
|---|---|---|
| Evento u horizonte ambiguo | Etiquetas inconsistentemente definidas; modelo sin interpretación útil. | No entrenar con datos institucionales hasta aprobar definición; retornar a Business Understanding. |
| Etiquetas `NO_EVALUABLE` o cierres no comparables | Falsos negativos o contaminación temporal. | Excluir y cuantificar; revisar calendario, cierre, reglas y cohortes en Data Understanding. |
| Historial incompleto para los tres primeros años/cortes | Población equivocada o sesgo de cobertura. | Derivar el inicio del primer cursado procesado, medir cobertura y excluir cadencias mixtas. |
| Fuga temporal/por alumno | Métricas infladas que no representan operación. | Snapshot en instante, split temporal/agrupado y test reservado; retornar a Data Preparation. |
| Desbalance | Accuracy engañosa; recall insuficiente. | Reportar soporte/métricas por clase; evaluar ponderación/balance dentro de folds de entrenamiento y sin tocar evaluación. |
| Training compite con DW/OLAP | Dashboards lentos o errores en consultas. | Worker separado y límites medidos; PRED-008 instrumenta contención. |
| Ámbito institucional filtrado solo por UI | Exposición de estudiantes fuera de facultad/carrera. | Revalidar permisos y `academicContexts` en servidor y probar consulta directa en PRED-006/PRED-007. |
| Probabilidad mal mapeada a clase | Semáforo/alerta se invierte o induce decisión equivocada. | Manifiesto explicita orden de clases y evento; pruebas de contrato/compatibilidad en PRED-005/PRED-006. |
| Drift o cobertura cambia tras despliegue | Menor utilidad progresiva. | Reportar distribución, periodo, cobertura y política de reevaluación; documentar retorno a Data Understanding/Modeling. |

## 6. Ciclo de trabajo CRISP-DM y gates

| Fase | Actividad en DSS-UATF | Entregable/gate | Issues principales | Retorno si falla |
|---|---|---|---|---|
| 1. Comprensión del negocio | Acordar evento, población, horizonte, instante, utilidad, costes de errores, uso autorizado. | Acta aprobada por DSA; criterios de éxito y límites de decisión humana. | PRED-001 | Volver a negociar objetivo/uso si utilidad o capacidad no están claras. |
| 2. Comprensión de los datos | Perfilar hechos/cobertura/cierres, campos, nulos, duplicados, etiquetas y población. | Informe de calidad/cobertura; contrato versionado; decisión de viabilidad. | PRED-002 | Volver a Business Understanding si la población/label no corresponde. |
| 3. Preparación | Crear snapshot, exclusiones, features point-in-time, splits; ajustar transforms solo en train; considerar SMOTE dentro de train/fold. | Dataset manifiesto y pipeline/splits reproducibles. | PRED-002, PRED-003 | Volver a Data Understanding por calidad o a Business Understanding por label. |
| 4. Modelado | Entrenar RF/XGBoost fuera del API con semilla/config/deps. | Candidatos sin activación automática, manifiesto y logs saneados. | PRED-003, PRED-005 | Volver a Data Preparation ante fuga, schema o evidencia insuficiente. |
| 5. Evaluación | CV/validación para selección; test independiente único para informe final; decisión institucional. | Matriz/métricas, reporte reproducible, decisión apto/no apto/insuficiente. | PRED-004 | Negocio por utilidad; datos/preparación por cobertura/leakage; modelado por rendimiento. |
| 6. Despliegue | Aprobar, activar, servir individual, publicar cohortes, autenticar consultas y monitorear operación. | Versión activa/rollback, contrato de publicación y operación, prueba de aislamiento. | PRED-005–008 | Reabrir fase causante; no activar si falla evidencia/seguridad/operación. |

## 7. Tipos de evidencia

- **Prueba de software:** fixtures sintéticos para validación de esquema, estados, errores, independencia, integridad de artefactos, autorización y estabilidad de publicación.
- **Evidencia predictiva:** evaluación sobre snapshot institucional autorizado y definición aprobada; no se reemplaza con fixtures ni entrenamiento que solo produjo un archivo.
- **Evidencia operativa:** métricas de CPU/memoria/IO, concurrencia, latencia/error, configuración de límites y carga comparable con/sin entrenamiento.
- **Evidencia de decisión:** fecha, actor/rol, versión de protocolo, interpretación institucional y decisión; no publicar valores personales en la documentación general.

## 8. Preguntas abiertas para las próximas decisiones

1. ¿DSA aprueba formalmente los dos targets, horizontes, elegibilidad de tres años y el instante de predicción para abandono de materia?
2. ¿Qué métricas/costes y capacidad de atención fijará DSA como criterio de aptitud antes de abrir el test final?
3. ¿El consumo requiere scoring poblacional además de inferencia puntual, con qué frecuencia y latencia?
4. ¿Quién puede solicitar training/promoción y quién autoriza consultas individuales para cada contexto académico?

Estas preguntas no impiden especificar interfaces con campos semánticos versionados, pero deben quedar resueltas antes de certificar un modelo para uso institucional.
