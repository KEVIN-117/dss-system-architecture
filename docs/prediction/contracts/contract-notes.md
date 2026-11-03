# Notas de contrato — Prediction API v1 (borrador)

El OpenAPI `prediction-api-v1.yaml` es el contrato de referencia PRED-001; la inferencia puntual está implementada en PRED-006, aunque el API no queda habilitado para uso institucional hasta aprobar y configurar las decisiones pendientes. Convención de versionado: la ruta externa `/v1` fija compatibilidad de API; cada objeto de datos/modelo lleva `contract_version`; cualquier cambio incompatible exige una nueva versión mayor. El archivo conserva `1.0.0-draft` hasta que DSA/TI aprueben decisiones de negocio, seguridad e infraestructura.

## Flujos cubiertos

- Inferencia sincrónica individual desde perfil/corte confiable. El body identifica la entidad/corte; no acepta features libres como prueba de elegibilidad.
- Inferencia aceptada de `program_dropout` (estudiante–programa–corte). La ruta `course_abandonment` permanece experimental y no forma parte de la capacidad publicable de PRED-007: `fact_cursado.es_abandono` solo se conoce tras procesar el cierre.
- Envío de entrenamiento asíncrono y consulta de job; `202 Accepted`, `job_id`, URI de estado, idempotency key y error estable.
- Snapshot de datos y manifiesto reproducibles; artefacto de modelo separado de candidato/promoción/rollback.
- Publicación poblacional de `program_dropout` mediante `prediction_batch`, outbox y `prediction_result` en `ml_workspace`; los resultados solo aparecen por la vista de consulta cuando el estado del lote es `PUBLISHED`. No se escribe en `fact_retencion_desercion`.

## Semántica provisional

- `event_code`, clase positiva/negativa, horizonte, instante de predicción y elegibilidad se declaran en `TargetDefinition` y el manifiesto de modelo. Ningún valor se fija en el esquema mientras falta aprobación DSA.
- El DW ya distingue `RETENIDO`, `DESERTOR` y `NO_EVALUABLE`; la propuesta de binarización trata solo los dos primeros como evento/no evento y excluye/reporta el último. Validar que el horizonte del modelo coincida con la regla implementada para el cierre siguiente.
- `predicted_class` representa la clase que emite el modelo. `event_probability` se asocia al evento definido, está en [0,1] y puede ser `null` si no se produce. La versión de artefacto guarda el orden de clases. La API no calcula banda alto/medio/bajo hasta aprobar umbrales y calibración.
- La elegibilidad solicitada para el MVP cubre tres años académicos: tres cierres anuales o seis semestrales desde el primer cursado procesado. `event_type` determina evento y grano; los modelos se resuelven por evento/cadencia para evitar mezclar targets.
- La inferencia online no guarda la respuesta en el DW. El endpoint devuelve un `prediction_id` de correlación, pero no crea un registro persistente. PRED-007 define el contrato de publicación; las predicciones jamás se escribirán como resultados observados en `fact_retencion_desercion`.
- El modelo se carga completo para una inferencia; no se cambia entre resolución de preprocesamiento y clasificación. Solo artefactos con `lifecycle_state=APPROVED` se sirven.
- `academic_cut.cut_id` es referencia contractual, no afirma que el campo se llame `closure_id`; el adaptador DW fijará el mapeo.

## Autenticación/autorización

- Se exige bearer token para operaciones de usuario. El API valida token también cuando viene desde BFF: firma/JWKS, `iss`, `aud`, `exp`, `nbf` y sujeto.
- El servicio no confía en headers de usuario, rol, facultad o carrera aportados por el cliente. `subject_ref`, `program_ref` y corte se resuelven contra datos autorizados; facultad/carrera permitidas proceden del perfil/contextos institucionales confirmados.
- `training-jobs` requiere permiso de operación ML. Ningún rol existente se asigna automáticamente: `SUPERADMIN` es técnico y el RBAC actual lo separa de permisos académicos.
- Las lecturas/escrituras SQL usan credenciales de runtime de mínimo privilegio; sin `dw_owner`/`dw_publisher` ni cuenta OLTP. Esquema y grants de publicación requieren migración y revisión del equipo DW.
- 401 significa token ausente/inválido; 403 significa identidad válida sin permiso/ámbito. Para evitar enumeración de estudiantes, `404` no revela si existe un perfil fuera del ámbito.

## Errores, reintentos e idempotencia

| HTTP | Uso | Reintento |
|---|---|---|
| 400 | JSON o estructura incorrecta | No hasta corregir request. |
| 401 / 403 | Token/permiso/ámbito | Solo después de renovar identidad o cambiar ámbito autorizado. |
| 404 | Trabajo o perfil no visible/disponible | No ciego; el detalle no permite enumeración. |
| 409 | Idempotency key asociada a body diferente, corte incompatible o estado inválido | Consultar el recurso existente y reconciliar. |
| 422 | Perfil fuera de población, datos insuficientes, corte no elegible | No; resolver dato/regla. |
| 429 | Concurrencia o capacidad de worker llena | Sí, respetar Retry-After con backoff y jitter. |
| 503 | DW/workspace/modelo requerido indisponible; ninguna predicción ficticia | Sí, limitado y con backoff según política. |
| 504 | Límite de inferencia excedido | No reintentar agresivamente; revisar timeout/carga. |

No registrar perfiles, features, tokens, notas ni identificadores naturales completos. Telemetría: request/job ID, actor pseudonimizado, modelo/dataset/corte, fase, conteos, error estable, latencia, CPU/memoria/IO y resultado de autorización. Retención exacta de auditoría es una decisión TI/DSA pendiente.

## Compatibilidad y pendientes antes de producción

1. Confirmar los nombres de clase del dominio y objetivo/horizonte.
2. Sustituir `subject_ref`, `program_ref`, `cut_id`, snapshot URI y campos de features por el contrato aprobado del DW/identidad.
3. Acordar audience/roles de Keycloak y cómo el motor lee los `academicContexts` confiables.
4. Confirmar modo de inferencia y scoring poblacional, idempotencia y estados de publicación.
5. Decidir almacenamiento de artefactos/jobs/snapshots, cifrado, límites, retención y rollback.
6. Resolver si el progreso se consulta por HTTP/polling o requiere SSE; el esquema permite evolución sin fijar transporte ahora.
7. Publicación transaccional y acceso BFF por ámbito implementados en PRED-007; validar migración, flujo Compose y panel con los datos Faker.
8. Para abandono de materia prospectivo, exponer en DW las inscripciones/cargas de materias disponibles antes del cierre y con disponibilidad temporal comprobable; `fact_cursado` solo aparece tras procesar el resultado del período.
